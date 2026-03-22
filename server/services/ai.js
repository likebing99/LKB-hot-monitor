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
        max_tokens: options.maxTokens ?? 2000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`OpenRouter API error ${response.status}:`, errText);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('OpenRouter call error:', err.message);
    return null;
  }
}

/**
 * AI 分析热点：真假甄别 + 摘要 + 热度评分
 */
export async function analyzeHotspot(newsItem, keyword, apiKey, model) {
  const prompt = `你是一个专业的AI领域新闻分析专家。请分析以下新闻内容，并以 JSON 格式返回分析结果。

新闻标题：${newsItem.title}
新闻摘要：${newsItem.snippet || '无'}
来源：${newsItem.source}
来源URL：${newsItem.url || '无'}
监控关键词：${keyword}

请返回严格的 JSON（不要包含 markdown 代码块标记）：
{
  "is_relevant": true/false,       // 是否与关键词真正相关
  "is_verified": true/false,       // 内容是否真实可信（非标题党、非假消息）
  "confidence": 0.0-1.0,           // 判断置信度
  "summary": "中文摘要，100字以内",
  "heat_score": 1-10,              // 热度评分
  "reason": "判断理由，简要说明"
}`;

  const content = await callOpenRouter([
    { role: 'system', content: '你是AI领域新闻分析专家，擅长辨别真假新闻和评估热度。只返回JSON，不要其他内容。' },
    { role: 'user', content: prompt },
  ], apiKey, { model });

  if (!content) {
    return {
      is_relevant: true,
      is_verified: false,
      confidence: 0.5,
      summary: newsItem.snippet?.slice(0, 100) || newsItem.title,
      heat_score: 5,
      reason: 'AI分析不可用，返回默认结果',
    };
  }

  try {
    // 清理可能的 markdown 代码块标记
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    console.error('Failed to parse AI response:', content);
    return {
      is_relevant: true,
      is_verified: false,
      confidence: 0.5,
      summary: newsItem.snippet?.slice(0, 100) || newsItem.title,
      heat_score: 5,
      reason: 'AI返回格式解析失败',
    };
  }
}

/**
 * 批量分析 + 去重合并
 */
export async function analyzeAndDedupe(newsItems, keyword, apiKey, model) {
  if (!newsItems.length) return [];

  // 取前15条分析（控制API调用量）
  const toAnalyze = newsItems.slice(0, 15);

  const analyzed = [];
  for (const item of toAnalyze) {
    const analysis = await analyzeHotspot(item, keyword, apiKey, model);
    if (analysis.is_relevant && analysis.confidence >= 0.3) {
      analyzed.push({
        ...item,
        summary: analysis.summary,
        heat_score: analysis.heat_score,
        is_verified: analysis.is_verified ? 1 : 0,
        ai_analysis: JSON.stringify(analysis),
      });
    }
    // 控制调用频率
    await new Promise(r => setTimeout(r, 500));
  }

  // 按热度排序
  analyzed.sort((a, b) => b.heat_score - a.heat_score);

  // 简单去重：标题相似的只保留热度最高的
  const deduped = [];
  for (const item of analyzed) {
    const isDupe = deduped.some(d =>
      d.title.toLowerCase().slice(0, 30) === item.title.toLowerCase().slice(0, 30)
    );
    if (!isDupe) deduped.push(item);
  }

  return deduped;
}
