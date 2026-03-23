import RSSParser from 'rss-parser';

const parser = new RSSParser({
  timeout: 12000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; LKB-Hot-Monitor/1.0)',
  },
});

// 预设 AI/科技类 RSS 源（国内外均可访问）
const DEFAULT_FEEDS = [
  // 国际 AI 源
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { name: 'The Verge AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
  { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/' },
  { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/' },
  { name: 'Hacker News', url: 'https://hnrss.org/newest?q=AI+LLM+GPT' },
  { name: 'OpenAI Blog', url: 'https://openai.com/blog/rss.xml' },
  { name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml' },
  // 国内科技源
  { name: '36Kr', url: 'https://36kr.com/feed' },
  { name: '量子位', url: 'https://www.qbitai.com/feed' },
];

/**
 * 从单个 RSS 源获取文章
 */
async function fetchFeed(feed) {
  try {
    const result = await parser.parseURL(feed.url);
    return (result.items || []).slice(0, 10)
      .filter(item => (item.title || '').trim().length >= 10)
      .map(item => ({
      title: item.title || '',
      snippet: item.contentSnippet?.slice(0, 300) || item.content?.slice(0, 300) || '',
      url: item.link || '',
      source: feed.name,
      time: item.pubDate || item.isoDate || '',
      origin: 'rss',
    }));
  } catch (err) {
    console.error(`RSS feed error (${feed.name}):`, err.message);
    return [];
  }
}

/**
 * 从所有 RSS 源获取文章，按关键词过滤
 */
export async function fetchRSSFeeds(keyword) {
  const allItems = [];
  const feedPromises = DEFAULT_FEEDS.map(feed => fetchFeed(feed));
  const results = await Promise.allSettled(feedPromises);

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allItems.push(...result.value);
    }
  }

  // 按关键词模糊过滤（拆词匹配、大小写不敏感）
  if (keyword) {
    const kw = keyword.toLowerCase();
    // 将关键词拆分为子词（如 "DeepSeek V3" → ["deepseek", "v3"]）
    const subWords = kw.split(/[\s\-_]+/).filter(w => w.length >= 2);

    return allItems.filter(item => {
      const text = `${item.title} ${item.snippet}`.toLowerCase();
      // 完整关键词匹配 或 所有子词都出现
      return text.includes(kw) || (subWords.length > 1 && subWords.every(w => text.includes(w)));
    });
  }

  return allItems;
}

/**
 * 不带关键词过滤，获取所有 RSS 热点
 */
export async function fetchAllRSS() {
  const allItems = [];
  const feedPromises = DEFAULT_FEEDS.map(feed => fetchFeed(feed));
  const results = await Promise.allSettled(feedPromises);

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allItems.push(...result.value);
    }
  }

  return allItems;
}
