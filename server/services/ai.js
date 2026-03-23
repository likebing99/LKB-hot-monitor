const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'minimax/minimax-m2.5';

/**
 * 调用 OpenRouter API
 */
async function callOpenRouter(messages, apiKey, options = {}) {
  if (!apiKey) {
    console.warn('OpenRouter API key not configured');
    return null;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model || DEFAULT_MODEL,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 16000,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      clearTimeout(timer);
      const errText = await response.text();
      console.error(`OpenRouter API error ${response.status}:`, errText);
      return null;
    }

    const data = await response.json();
    clearTimeout(timer);
    const msg = data.choices?.[0]?.message;
    return msg?.content || msg?.reasoning || null;
  } catch (err) {
    console.error('OpenRouter call error:', err.message);
    return null;
  }
}

// ─── Query Expansion：关键词查询扩展 ────────────────────────────

// 内存缓存：同一次扫描周期内不重复调用
const _expansionCache = new Map();

/**
 * 使用 AI 将用户关键词扩展为多个语义相近的查询变体
 * @returns {string[]} 包含原始关键词 + 变体的数组
 */
export async function expandKeyword(keyword, apiKey, model) {
  if (_expansionCache.has(keyword)) {
    return _expansionCache.get(keyword);
  }

  const content = await callOpenRouter([
    {
      role: 'system',
      content: '你是搜索查询优化专家。根据用户的监控关键词，生成语义相近的搜索变体，用于提高检索召回率。只返回JSON数组，不要其他内容。',
    },
    {
      role: 'user',
      content: `为以下监控关键词生成5-8个搜索查询变体。变体应包括：
- 原词的不同写法（中英文、缩写、全称）
- 核心概念的同义表达
- 去掉版本号的简化形式（如果有版本号）
- 常见的相关搜索词

关键词：${keyword}

返回严格的 JSON 数组（不要包含 markdown 代码块标记），例如：
["变体1", "变体2", "变体3"]

注意：不要生成过于宽泛的变体（如将"Claude Sonnet 4.6"扩展为"AI"），变体必须和原关键词指向同一个具体事物。`,
    },
  ], apiKey, { model, temperature: 0.2 });

  let variants = [keyword]; // 始终包含原始关键词

  if (content) {
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        // 去重，并确保原始关键词在第一位
        const unique = new Set([keyword]);
        for (const v of parsed) {
          if (typeof v === 'string' && v.trim()) unique.add(v.trim());
        }
        variants = [...unique];
      }
    } catch {
      console.error('Failed to parse query expansion:', content?.slice(0, 200));
    }
  }

  _expansionCache.set(keyword, variants);
  console.log(`  🔍 Query expansion for "${keyword}": ${variants.length} variants → [${variants.join(', ')}]`);
  return variants;
}

/**
 * 清除查询扩展缓存（每次扫描结束时调用）
 */
export function clearExpansionCache() {
  _expansionCache.clear();
}

// ─── AI 分析热点：V2 严格相关性审核 ─────────────────────────────

/**
 * AI 分析热点：相关性审核 + 真假甄别 + 摘要 + 热度评分
 * @param {object} newsItem - 新闻条目
 * @param {string} keyword - 原始关键词
 * @param {string} apiKey
 * @param {string} model
 * @param {string[]} variants - 查询扩展变体列表
 */
export async function analyzeHotspot(newsItem, keyword, apiKey, model, variants = []) {
  const variantStr = variants.length > 1
    ? `\n关键词查询变体（这些都算"提到了关键词"）：${variants.join('、')}`
    : '';

  const prompt = `分析以下新闻内容与监控关键词的相关性。

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
- relevance_type: "direct"=内容主题围绕关键词展开, "indirect"=关键词不是主题但有实质关联, "none"=无关
- keyword_mentioned: 标题或摘要中是否明确出现了关键词或其任一查询变体
- is_relevant: 仅当 relevance_type 为 direct 或 indirect 时为 true
- confidence: 对整体判断的置信度`;

  const systemPrompt = `你是一个严格的AI领域新闻相关性审核专家。你的任务是判断新闻内容是否与监控关键词**真正相关**。

核心判断标准：
- "真正相关"意味着新闻的**主题**围绕关键词展开，而不仅仅是文中某处提到了该词
- 同名但不同领域的人/事物视为无关（如搜索"Sam Altman"时，"Breno Altman"的文章无关）
- 个人闲聊、感想碎碎念（如"vibe coding is so addictive"）即使提到关键词也视为无关，除非包含具有新闻价值的实质信息
- 间接相关的内容（如搜索"Claude Sonnet 4.6"时出现的"AI编程工具综合对比"）需要有实质性关联才算相关
- heat_score 低于3的内容通常不值得保留

只返回JSON，不要其他内容。`;

  const content = await callOpenRouter([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ], apiKey, { model });

  if (!content) {
    return {
      is_relevant: false,
      relevance_type: 'none',
      relevance_explanation: 'AI分析不可用',
      keyword_mentioned: false,
      is_verified: false,
      confidence: 0,
      summary: newsItem.snippet?.slice(0, 100) || newsItem.title,
      heat_score: 0,
      reason: 'AI分析不可用，默认标记为不相关',
    };
  }

  try {
    let cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    // Fix common AI output typos: ttrue→true, ffalse→false
    cleaned = cleaned.replace(/\bttrue\b/g, 'true').replace(/\bffalse\b/g, 'false');
    return JSON.parse(cleaned);
  } catch {
    console.error('Failed to parse AI response:', content);
    return {
      is_relevant: false,
      relevance_type: 'none',
      relevance_explanation: 'AI返回格式解析失败',
      keyword_mentioned: false,
      is_verified: false,
      confidence: 0,
      summary: newsItem.snippet?.slice(0, 100) || newsItem.title,
      heat_score: 0,
      reason: 'AI返回格式解析失败，默认标记为不相关',
    };
  }
}

// ─── V2 过滤逻辑 ───────────────────────────────────────────────

/**
 * 判断 AI 分析结果是否通过质量过滤
 */
function passesRelevanceFilter(analysis) {
  if (!analysis) return false;
  if (analysis.relevance_type === 'none') return false;
  if (!analysis.is_relevant) return false;
  if (analysis.confidence < 0.6) return false;
  if (analysis.heat_score < 3) return false;
  // 间接相关 + 没提到关键词 → 过滤
  if (analysis.relevance_type === 'indirect' && !analysis.keyword_mentioned) return false;
  return true;
}

/**
 * 批量分析 + 去重合并（5 并发批量，大幅提速）
 * @param {string[]} variants - 查询扩展变体列表
 */
export async function analyzeAndDedupe(newsItems, keyword, apiKey, model, { onItemReady, variants = [] } = {}) {
  if (!newsItems.length) return [];

  const toAnalyze = newsItems.slice(0, 15);
  const CONCURRENCY = 5;
  const analyzed = [];
  const seenTitleKeys = new Set();

  for (let i = 0; i < toAnalyze.length; i += CONCURRENCY) {
    const batch = toAnalyze.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(item => analyzeHotspot(item, keyword, apiKey, model, variants))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const item = batch[j];
      if (result.status === 'fulfilled') {
        const analysis = result.value;
        if (passesRelevanceFilter(analysis)) {
          const titleKey = item.title.toLowerCase().slice(0, 30);
          if (seenTitleKeys.has(titleKey)) continue;
          seenTitleKeys.add(titleKey);

          const enriched = {
            ...item,
            summary: analysis.summary,
            heat_score: analysis.heat_score,
            is_verified: analysis.is_verified ? 1 : 0,
            ai_analysis: JSON.stringify(analysis),
          };
          analyzed.push(enriched);
          if (onItemReady) {
            try { await onItemReady(enriched); } catch (e) { console.error('onItemReady error:', e.message); }
          }
        } else {
          console.log(`  🚫 AI filtered: type=${analysis.relevance_type} conf=${analysis.confidence} heat=${analysis.heat_score} mentioned=${analysis.keyword_mentioned} "${item.title?.slice(0, 50)}"`);
        }
      } else {
        console.error(`AI analysis failed for "${item.title?.slice(0, 30)}":`, result.reason?.message);
      }
    }
  }

  analyzed.sort((a, b) => b.heat_score - a.heat_score);
  return analyzed;
}
