/**
 * 诊断工具：展示被过滤掉的热点及过滤原因
 * 用法: node diagnose-filtered.mjs
 * 
 * 该脚本会重新执行一次搜索 + AI 分析流程，
 * 逐条显示每个 Twitter 结果是「通过」还是「被过滤」，以及具体原因。
 */
import 'dotenv/config';
import { initDatabase, queryAll, queryOne } from './db/init.js';
import { searchTwitter } from './services/twitter.js';
import { expandKeyword } from './services/ai.js';

// ─── AI 分析（直接内联，方便查看完整返回） ───
async function analyzeForDiagnosis(item, keyword, apiKey, model, variants = []) {
  const variantInfo = variants.length
    ? `\n该关键词的常见变体/相关术语：${variants.join('、')}`
    : '';
  
  const prompt = `你是一个专业的科技新闻编辑。请分析以下内容与关键词「${keyword}」的相关性。${variantInfo}

标题：${item.title}
内容：${item.snippet || '无'}
来源：${item.source}
${item.engagement ? `互动数据：${JSON.stringify(item.engagement)}` : ''}

严格判定规则：
1. 「直接相关 (direct)」：内容主题就是关于「${keyword}」或其变体
2. 「间接相关 (indirect)」：内容主题是其他事物，但有实质性地提及或对比了「${keyword}」
3. 「无关 (none)」：内容与「${keyword}」没有实质关联

以下情况必须判定为 none：
- 同名但不同领域的人/事物（如 Breno Altman ≠ Sam Altman）
- 仅在背景、列表、广告中一笔带过地提到了关键词
- 个人感想、闲聊、段子，没有实质新闻价值
- 内容主题是竞品/其他产品，只是顺带对比了一下

请返回以下 JSON（不要包含其他内容）：
{
  "is_relevant": boolean,
  "relevance_type": "direct" | "indirect" | "none",
  "relevance_explanation": "一句话说明为何如此判定",
  "keyword_mentioned": boolean,
  "confidence": 0.0-1.0,
  "heat_score": 1-10,
  "is_verified": boolean,
  "summary": "中文摘要（30字以内）",
  "tags": ["标签1", "标签2"]
}`;

  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 16000,
        temperature: 0.3,
      }),
    });

    if (!resp.ok) {
      return { error: `API ${resp.status}: ${resp.statusText}` };
    }

    const data = await resp.json();
    let text = data.choices?.[0]?.message?.content || '';
    
    // 清理 markdown wrapper
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    // 修复 AI 打字错误
    text = text.replace(/\bttrue\b/g, 'true').replace(/\bffalse\b/g, 'false');
    
    return JSON.parse(text);
  } catch (e) {
    return { error: e.message };
  }
}

// ─── 过滤规则（与生产环境 ai.js 完全一致） ───
function checkFilter(analysis) {
  const reasons = [];
  let pass = true;

  if (!analysis || analysis.error) {
    return { pass: false, reasons: ['AI 分析失败: ' + (analysis?.error || 'unknown')] };
  }

  if (analysis.relevance_type === 'none') {
    reasons.push(`relevance_type = none（AI 判定无关）`);
    pass = false;
  }
  if (!analysis.is_relevant) {
    reasons.push(`is_relevant = false`);
    pass = false;
  }
  if (analysis.confidence < 0.6) {
    reasons.push(`confidence = ${analysis.confidence} < 0.6`);
    pass = false;
  }
  if (analysis.heat_score < 3) {
    reasons.push(`heat_score = ${analysis.heat_score} < 3`);
    pass = false;
  }
  if (analysis.relevance_type === 'indirect' && !analysis.keyword_mentioned) {
    reasons.push(`间接相关但未提及关键词 (indirect + keyword_mentioned=false)`);
    pass = false;
  }

  if (pass) reasons.push('✅ 全部通过');
  return { pass, reasons };
}

// ─── 源级质量校验（与 scheduler.js onItemReady 一致） ───
function checkSourceQuality(item) {
  if (item.source === 'twitter' || item.origin === 'twitter') {
    const eng = item.engagement || {};
    const likes = eng.likes || 0;
    const retweets = eng.retweets || 0;
    const views = eng.views || 0;
    const textLen = (item.snippet || item.title || '').length;
    
    const issues = [];
    if (likes < 50) issues.push(`likes=${likes} < 50`);
    if (retweets < 20) issues.push(`retweets=${retweets} < 20`);
    if (views < 2000) issues.push(`views=${views} < 2000`);
    if (textLen < 100) issues.push(`textLen=${textLen} < 100`);
    
    const text = (item.snippet || item.title || '').trimStart();
    if (text.startsWith('@')) issues.push('纯回复推文 (以@开头)');
    
    if (issues.length > 0) {
      return { pass: false, reasons: issues };
    }
  }
  return { pass: true, reasons: [] };
}

// ─── 新鲜度校验 ───
function checkFreshness(item) {
  if (!item.time) return { pass: false, reason: '无时间戳' };
  const t = new Date(item.time);
  if (isNaN(t.getTime())) return { pass: false, reason: `时间格式无法解析: ${item.time}` };
  const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
  if (Date.now() - t.getTime() > TEN_DAYS_MS) return { pass: false, reason: `超过10天: ${item.time}` };
  return { pass: true, reason: null };
}

// ─── 去重校验 ───
function checkDuplicate(item) {
  const existing = queryOne(
    "SELECT id, title FROM hotspots WHERE (title = ? AND source = ?) OR (source_url = ? AND source_url != '')",
    [item.title, item.source || item.origin, item.url || '']
  );
  if (existing) {
    return { isDup: true, existingId: existing.id };
  }
  return { isDup: false };
}

// ═══════════════════════════════════════════════════════
//  主流程
// ═══════════════════════════════════════════════════════
async function main() {
  await initDatabase();

  const apiKey = process.env.OPENROUTER_API_KEY;
  const aiModel = process.env.AI_MODEL || 'minimax/minimax-m1';
  const twitterKey = process.env.TWITTER_API_KEY || queryOne("SELECT value FROM settings WHERE key = 'twitter_api_key'")?.value;

  // 获取 Agentic workflow 关键词
  const kw = queryOne("SELECT * FROM keywords WHERE keyword LIKE '%agentic%' AND is_active = 1")
           || queryOne("SELECT * FROM keywords WHERE keyword LIKE '%Agentic%'");
  
  if (!kw) {
    console.log('❌ 未找到 Agentic workflow 相关关键词');
    return;
  }
  console.log(`\n🔑 关键词: "${kw.keyword}" (id=${kw.id})\n`);

  // 查询扩展
  console.log('🔄 正在生成查询扩展...');
  let variants = [];
  try {
    variants = await expandKeyword(kw.keyword, apiKey, aiModel);
    console.log(`   变体: ${variants.join(', ')}\n`);
  } catch (e) {
    console.log(`   查询扩展失败: ${e.message}\n`);
  }

  // 搜索 Twitter
  const searchQueries = [kw.keyword, ...variants.slice(0, 3)];
  console.log(`🔍 搜索查询: ${searchQueries.join(' | ')}\n`);
  
  let allTwitter = [];
  const seenUrls = new Set();
  
  for (const q of searchQueries) {
    try {
      const results = await searchTwitter(q, twitterKey);
      for (const item of results) {
        const key = item.url || item.title;
        if (!seenUrls.has(key)) {
          seenUrls.add(key);
          allTwitter.push(item);
        }
      }
      console.log(`   "${q}" → ${results.length} 条`);
    } catch (e) {
      console.log(`   "${q}" → 失败: ${e.message}`);
    }
  }

  console.log(`\n📊 Twitter 总计: ${allTwitter.length} 条（去重后）\n`);
  console.log('═'.repeat(80));

  // 逐条分析
  let passCount = 0;
  let filteredCount = 0;

  for (let i = 0; i < allTwitter.length; i++) {
    const item = allTwitter[i];
    console.log(`\n【${i + 1}/${allTwitter.length}】${item.title?.slice(0, 70)}`);
    console.log(`   URL: ${item.url || '无'}`);
    console.log(`   时间: ${item.time || '无'}`);
    
    const eng = item.engagement || {};
    console.log(`   互动: ❤️${eng.likes || 0}  🔄${eng.retweets || 0}  👁️${eng.views || 0}  💬${eng.replies || 0}`);
    
    // Step 1: 新鲜度
    const fresh = checkFreshness(item);
    if (!fresh.pass) {
      console.log(`   ❌ 阶段1-新鲜度过滤: ${fresh.reason}`);
      filteredCount++;
      console.log('─'.repeat(80));
      continue;
    }
    console.log(`   ✅ 阶段1-新鲜度: 通过`);

    // Step 2: AI 分析
    console.log(`   ⏳ 阶段2-AI分析中...`);
    const analysis = await analyzeForDiagnosis(item, kw.keyword, apiKey, aiModel, variants);
    
    if (analysis.error) {
      console.log(`   ❌ 阶段2-AI分析失败: ${analysis.error}`);
      filteredCount++;
      console.log('─'.repeat(80));
      continue;
    }
    
    console.log(`   📋 AI判定:`);
    console.log(`      relevance_type: ${analysis.relevance_type}`);
    console.log(`      is_relevant: ${analysis.is_relevant}`);
    console.log(`      confidence: ${analysis.confidence}`);
    console.log(`      heat_score: ${analysis.heat_score}`);
    console.log(`      keyword_mentioned: ${analysis.keyword_mentioned}`);
    console.log(`      explanation: ${analysis.relevance_explanation}`);
    console.log(`      summary: ${analysis.summary}`);

    // Step 3: AI 过滤规则
    const filterResult = checkFilter(analysis);
    if (!filterResult.pass) {
      console.log(`   ❌ 阶段3-AI过滤: ${filterResult.reasons.join(' | ')}`);
      filteredCount++;
      console.log('─'.repeat(80));
      continue;
    }
    console.log(`   ✅ 阶段3-AI过滤: 通过`);

    // Step 4: Twitter 源级质量校验
    const qualityResult = checkSourceQuality(item);
    if (!qualityResult.pass) {
      console.log(`   ❌ 阶段4-源级质量: ${qualityResult.reasons.join(' | ')}`);
      filteredCount++;
      console.log('─'.repeat(80));
      continue;
    }
    console.log(`   ✅ 阶段4-源级质量: 通过`);

    // Step 5: 去重
    const dupResult = checkDuplicate(item);
    if (dupResult.isDup) {
      console.log(`   ⚠️ 阶段5-去重: 已存在 (id=${dupResult.existingId})`);
      filteredCount++;
      console.log('─'.repeat(80));
      continue;
    }
    console.log(`   ✅ 阶段5-去重: 通过（新内容）`);

    console.log(`   🎉 最终结果: ✅ 通过所有过滤 → 会被保存`);
    passCount++;
    console.log('─'.repeat(80));
  }

  // 汇总
  console.log('\n' + '═'.repeat(80));
  console.log(`\n📊 诊断汇总:`);
  console.log(`   Twitter 搜索结果: ${allTwitter.length} 条`);
  console.log(`   通过所有过滤: ${passCount} 条`);
  console.log(`   被过滤掉: ${filteredCount} 条`);
  console.log(`   过滤率: ${allTwitter.length > 0 ? ((filteredCount / allTwitter.length) * 100).toFixed(1) : 0}%\n`);
}

main().catch(console.error);
