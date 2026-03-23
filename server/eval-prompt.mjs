/**
 * AI Prompt 评估脚本 — 用已有数据库数据作为测试集
 * 
 * 用法:
 *   node eval-prompt.mjs                # 用新prompt重新分析，输出对比报告
 *   node eval-prompt.mjs --dry-run      # 仅展示旧数据基线，不调用AI
 *   node eval-prompt.mjs --sample 10    # 只取10条样本（节省API费用）
 */
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

import { initDatabase, queryAll, queryOne } from './db/init.js';

// ─── 复制 ai.js 的 callOpenRouter ───────────────────────────────
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'minimax/minimax-m2.5';

async function callOpenRouter(messages, apiKey, options = {}) {
  if (!apiKey) { console.warn('No API key'); return null; }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model || DEFAULT_MODEL,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 16000,
      }),
      signal: controller.signal,
    });
    if (!response.ok) { clearTimeout(timer); console.error(`API error ${response.status}: ${await response.text().catch(() => '')}`); return null; }
    const data = await response.json();
    clearTimeout(timer);
    const msg = data.choices?.[0]?.message;
    const result = msg?.content || msg?.reasoning || null;
    if (!result) console.error('Empty AI response:', JSON.stringify(data).slice(0, 300));
    return result;
  } catch { return null; }
}

// ─── 新 Prompt (V2) ────────────────────────────────────────────
function buildNewPrompt(newsItem, keyword, variants) {
  const variantStr = variants.length ? `\n关键词查询变体：${variants.join('、')}` : '';
  return {
    system: `你是一个严格的AI领域新闻相关性审核专家。你的任务是判断新闻内容是否与监控关键词**真正相关**。

核心判断标准：
- "真正相关"意味着新闻的**主题**围绕关键词展开，而不仅仅是文中某处提到了该词
- 同名但不同领域的人/事物视为无关（如搜索"Sam Altman"时，"Breno Altman"的文章无关）
- 个人闲聊、感想碎碎念（如"vibe coding is so addictive"）即使提到关键词也视为无关，除非包含具有新闻价值的实质信息
- 间接相关的内容（如搜索"Claude Sonnet 4.6"时出现的"AI编程工具综合对比"）需要有实质性关联才算相关

只返回JSON，不要其他内容。`,
    user: `分析以下新闻内容与监控关键词的相关性。

新闻标题：${newsItem.title}
新闻摘要：${newsItem.snippet || '无'}
来源：${newsItem.source}
来源URL：${newsItem.url || '无'}
监控关键词：${keyword}${variantStr}

请返回严格的 JSON（不要包含 markdown 代码块标记）：
{
  "is_relevant": true/false,
  "relevance_type": "direct/indirect/none",
  "relevance_explanation": "用1-2句话解释为什么相关或不相关",
  "keyword_mentioned": true/false,
  "is_verified": true/false,
  "confidence": 0.0-1.0,
  "summary": "中文摘要，100字以内",
  "heat_score": 1-10,
  "reason": "判断理由"
}

字段说明：
- relevance_type: "direct"=内容主题围绕关键词, "indirect"=关键词不是主题但有实质关联, "none"=无关
- keyword_mentioned: 标题或摘要中是否出现了关键词或其查询变体中的任何一个
- confidence: 对整体判断的置信度
- is_relevant: 仅当 relevance_type 为 direct 或 indirect 时为 true`
  };
}

async function analyzeWithNewPrompt(newsItem, keyword, apiKey, model, variants = []) {
  const p = buildNewPrompt(newsItem, keyword, variants);
  const content = await callOpenRouter([
    { role: 'system', content: p.system },
    { role: 'user', content: p.user },
  ], apiKey, { model });

  if (!content) {
    console.error(`  ⚠️ Null response for: "${(newsItem.title || '').slice(0, 50)}"`);
    return null;
  }
  try {
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error(`  ⚠️ Parse fail for "${(newsItem.title || '').slice(0, 40)}": ${content.slice(0, 300)}`);
    return null;
  }
}

// ─── 新过滤逻辑 V2 ────────────────────────────────────────────
function passesNewFilter(analysis) {
  if (!analysis) return false;
  if (analysis.relevance_type === 'none') return false;
  if (!analysis.is_relevant) return false;
  if (analysis.confidence < 0.6) return false;
  if (analysis.heat_score < 3) return false;
  // 间接相关 + 没提到关键词 → 过滤
  if (analysis.relevance_type === 'indirect' && !analysis.keyword_mentioned) return false;
  return true;
}

// ─── 旧过滤逻辑回放 ───────────────────────────────────────────
function passesOldFilter(analysis) {
  if (!analysis) return false;
  return analysis.is_relevant && analysis.confidence >= 0.3;
}

// ─── Main ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const sampleIdx = args.indexOf('--sample');
const sampleSize = sampleIdx >= 0 ? parseInt(args[sampleIdx + 1]) || 10 : null;

await initDatabase();

const apiKey = queryOne("SELECT value FROM settings WHERE key = 'openrouter_api_key'")?.value || process.env.OPENROUTER_API_KEY;
const aiModel = queryOne("SELECT value FROM settings WHERE key = 'ai_model'")?.value || '';

// 取测试集: 已验证的 hotspots (有完整 ai_analysis)
let testItems = queryAll(`
  SELECT h.id, h.title, h.source, h.source_url, h.ai_analysis, h.raw_data, h.is_verified,
         k.keyword
  FROM hotspots h
  LEFT JOIN keywords k ON h.keyword_id = k.id
  WHERE h.ai_analysis IS NOT NULL AND h.ai_analysis != ''
  ORDER BY h.created_at DESC
`);

if (sampleSize) testItems = testItems.slice(0, sampleSize);
console.log(`\n📊 Evaluation dataset: ${testItems.length} items (dryRun=${dryRun})\n`);

// ─── Baseline: 旧 Prompt 结果统计 ──────────────────────────────
let oldPass = 0, oldFail = 0;
const baseline = testItems.map(item => {
  let oldAnalysis = null;
  try { oldAnalysis = JSON.parse(item.ai_analysis); } catch {}
  const pass = passesOldFilter(oldAnalysis);
  if (pass) oldPass++; else oldFail++;
  return { item, oldAnalysis, oldPass: pass };
});

console.log(`=== BASELINE (Old Prompt, threshold confidence≥0.3) ===`);
console.log(`  Pass: ${oldPass} | Filtered: ${oldFail} | Total: ${testItems.length}`);
console.log();

if (dryRun) {
  // 展示旧数据分布
  const buckets = { direct_high: [], indirect_ok: [], low_conf: [], low_heat: [], noisy: [] };
  for (const { item, oldAnalysis } of baseline) {
    const c = oldAnalysis?.confidence || 0;
    const h = oldAnalysis?.heat_score || 0;
    const tag = `[${item.keyword}] conf=${c} heat=${h} "${(item.title || '').slice(0, 60)}"`;
    if (c >= 0.8 && h >= 5) buckets.direct_high.push(tag);
    else if (c >= 0.6 && h >= 3) buckets.indirect_ok.push(tag);
    else if (c < 0.6) buckets.low_conf.push(tag);
    else if (h < 3) buckets.low_heat.push(tag);
    else buckets.noisy.push(tag);
  }
  console.log(`--- High quality (conf≥0.8, heat≥5): ${buckets.direct_high.length} ---`);
  buckets.direct_high.slice(0, 5).forEach(t => console.log(`  ${t}`));
  console.log(`--- Medium (conf≥0.6, heat≥3): ${buckets.indirect_ok.length} ---`);
  buckets.indirect_ok.slice(0, 5).forEach(t => console.log(`  ${t}`));
  console.log(`--- Low confidence (<0.6): ${buckets.low_conf.length} ---`);
  buckets.low_conf.forEach(t => console.log(`  ${t}`));
  console.log(`--- Low heat (<3): ${buckets.low_heat.length} ---`);
  buckets.low_heat.forEach(t => console.log(`  ${t}`));
  console.log(`--- Other: ${buckets.noisy.length} ---`);
  buckets.noisy.slice(0, 5).forEach(t => console.log(`  ${t}`));
  process.exit(0);
}

// ─── 新 Prompt 评估 ────────────────────────────────────────────
if (!apiKey) {
  console.error('❌ No OpenRouter API key configured. Cannot run new prompt evaluation.');
  process.exit(1);
}

console.log(`=== Running NEW Prompt on ${testItems.length} items (5 concurrent) ===\n`);

const CONCURRENCY = 3;
const results = [];

for (let i = 0; i < baseline.length; i += CONCURRENCY) {
  const batch = baseline.slice(i, i + CONCURRENCY);
  const promises = batch.map(async ({ item, oldAnalysis, oldPass }) => {
    let rawItem = {};
    try { rawItem = JSON.parse(item.raw_data || '{}'); } catch {}
    const newsItem = {
      title: item.title,
      snippet: rawItem.snippet || oldAnalysis?.summary || '',
      source: item.source,
      url: item.source_url,
    };

    // Try up to 2 times
    let newAnalysis = await analyzeWithNewPrompt(newsItem, item.keyword || '', apiKey, aiModel);
    if (!newAnalysis) {
      await new Promise(r => setTimeout(r, 2000));
      newAnalysis = await analyzeWithNewPrompt(newsItem, item.keyword || '', apiKey, aiModel);
    }
    const newPass = passesNewFilter(newAnalysis);

    return { item, oldAnalysis, oldPass, newAnalysis, newPass };
  });

  const settled = await Promise.allSettled(promises);
  for (const r of settled) {
    if (r.status === 'fulfilled') results.push(r.value);
  }
  process.stdout.write(`  Processed ${Math.min(i + CONCURRENCY, baseline.length)}/${baseline.length}\r`);
}

console.log('\n');

// ─── 分类统计 ──────────────────────────────────────────────────
const categories = {
  kept_both: [],      // 新旧都保留
  filtered_new: [],   // 旧保留但新过滤（✅ 正确过滤 or ⚠️ 误杀）
  added_new: [],      // 旧过滤但新保留（不太可能，因为新更严格）
  filtered_both: [],  // 新旧都过滤
};

for (const r of results) {
  if (r.oldPass && r.newPass) categories.kept_both.push(r);
  else if (r.oldPass && !r.newPass) categories.filtered_new.push(r);
  else if (!r.oldPass && r.newPass) categories.added_new.push(r);
  else categories.filtered_both.push(r);
}

console.log(`╔══════════════════════════════════════════════════════╗`);
console.log(`║         EVALUATION REPORT — NEW vs OLD PROMPT       ║`);
console.log(`╠══════════════════════════════════════════════════════╣`);
console.log(`║ Total test items:           ${String(results.length).padStart(4)}                     ║`);
console.log(`║ Old: pass=${String(categories.kept_both.length + categories.filtered_new.length).padStart(4)}, filter=${String(categories.filtered_both.length + categories.added_new.length).padStart(4)}              ║`);
console.log(`║ New: pass=${String(categories.kept_both.length + categories.added_new.length).padStart(4)}, filter=${String(categories.filtered_new.length + categories.filtered_both.length).padStart(4)}              ║`);
console.log(`╠══════════════════════════════════════════════════════╣`);
console.log(`║ ✅ Kept by both:            ${String(categories.kept_both.length).padStart(4)}                     ║`);
console.log(`║ 🗑️  NEW filtered (old kept): ${String(categories.filtered_new.length).padStart(4)}                     ║`);
console.log(`║ ➕ NEW added (old filtered): ${String(categories.added_new.length).padStart(4)}                     ║`);
console.log(`║ ❌ Filtered by both:         ${String(categories.filtered_both.length).padStart(4)}                     ║`);
console.log(`╚══════════════════════════════════════════════════════╝`);

// 详细展示被新 Prompt 过滤的项（最关键的审核区域）
if (categories.filtered_new.length > 0) {
  console.log(`\n─── 🗑️  Items NEWLY FILTERED (were kept before, now removed) ───`);
  for (const r of categories.filtered_new) {
    const na = r.newAnalysis || {};
    const oa = r.oldAnalysis || {};
    console.log(`\n  [${r.item.keyword}] "${(r.item.title || '').slice(0, 80)}"`);
    console.log(`    OLD: conf=${oa.confidence} heat=${oa.heat_score} reason="${(oa.reason || '').slice(0, 80)}"`);
    console.log(`    NEW: type=${na.relevance_type} conf=${na.confidence} heat=${na.heat_score} mentioned=${na.keyword_mentioned}`);
    console.log(`    NEW reason: "${(na.relevance_explanation || na.reason || '').slice(0, 120)}"`);
  }
}

if (categories.kept_both.length > 0) {
  console.log(`\n─── ✅ Kept by both (spot check, first 5) ───`);
  for (const r of categories.kept_both.slice(0, 5)) {
    const na = r.newAnalysis || {};
    console.log(`  [${r.item.keyword}] type=${na.relevance_type} conf=${na.confidence} mentioned=${na.keyword_mentioned} "${(r.item.title || '').slice(0, 70)}"`);
  }
}

if (categories.added_new.length > 0) {
  console.log(`\n─── ➕ Newly ADDED (old filtered, now kept — unexpected) ───`);
  for (const r of categories.added_new) {
    const na = r.newAnalysis || {};
    console.log(`  [${r.item.keyword}] type=${na.relevance_type} conf=${na.confidence} "${(r.item.title || '').slice(0, 70)}"`);
  }
}

console.log(`\n✅ Evaluation complete.`);
process.exit(0);
