import * as cheerio from 'cheerio';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * 通过 cn.bing.com 搜索新闻（国内可访问）
 */
export async function searchBing(keyword, count = 10) {
  try {
    const query = encodeURIComponent(`${keyword} AI`);
    const url = `https://cn.bing.com/news/search?q=${query}&FORM=HDRSC6`;

    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml',
      },
    }, 10000);

    if (!response.ok) {
      console.error(`Bing search failed: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];

    // Bing News card selectors
    $('div.news-card, .newsitem, div.caption').each((i, el) => {
      if (i >= count) return false;
      const $el = $(el);
      const title = ($el.find('a.title').text() || $el.find('a').first().text()).trim();
      const link = ($el.find('a.title').attr('href') || $el.find('a').first().attr('href') || '');
      const snippet = ($el.find('.snippet').text() || $el.find('div.snippet, .description').text()).trim();
      const source = $el.find('.source').text().trim();

      if (title && title.length > 5) {
        results.push({
          title,
          url: link.startsWith('http') ? link : `https://cn.bing.com${link}`,
          snippet,
          source: source || 'Bing News',
          time: '',
          origin: 'web',
        });
      }
    });

    // Fallback: generic selectors
    if (results.length === 0) {
      $('li.b_algo, .b_algo, .card-with-cluster').each((i, el) => {
        if (i >= count) return false;
        const $el = $(el);
        const title = $el.find('h2 a, a.title').text().trim();
        const link = $el.find('h2 a, a.title').attr('href') || '';

        if (title && title.length > 5) {
          results.push({
            title,
            url: link.startsWith('http') ? link : `https://cn.bing.com${link}`,
            snippet: $el.find('.b_caption p, .snippet').text().trim(),
            source: 'Bing',
            time: '',
            origin: 'web',
          });
        }
      });
    }

    console.log(`  🔍 Bing: ${results.length} results for "${keyword}"`);
    return results;
  } catch (err) {
    console.error('Bing crawler error:', err.message);
    return [];
  }
}

/**
 * 通过搜狗新闻搜索（国内优质源）
 */
export async function searchSogou(keyword, count = 10) {
  try {
    const query = encodeURIComponent(keyword);
    const url = `https://news.sogou.com/news?query=${query}&mode=1&sort=0`;

    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
      },
    }, 10000);

    if (!response.ok) return [];
    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];

    $('div.news-list li, .vrwrap, .rb').each((i, el) => {
      if (i >= count) return false;
      const $el = $(el);
      const title = ($el.find('h3 a').text() || $el.find('.news-title-wr a').text()).trim();
      const link = $el.find('h3 a, .news-title-wr a').attr('href') || '';
      const snippet = ($el.find('.news-txt').text() || $el.find('.space-txt').text()).trim();
      const source = $el.find('.news-from span').first().text().trim();
      const time = $el.find('.news-from span').last().text().trim();

      if (title && title.length > 3) {
        results.push({
          title,
          url: link,
          snippet,
          source: source || '搜狗新闻',
          time,
          origin: 'web',
        });
      }
    });

    console.log(`  🔍 Sogou: ${results.length} results for "${keyword}"`);
    return results;
  } catch (err) {
    console.error('Sogou crawler error:', err.message);
    return [];
  }
}

/**
 * 通过百度新闻搜索
 */
export async function searchBaidu(keyword, count = 10) {
  try {
    const query = encodeURIComponent(keyword);
    const url = `https://www.baidu.com/s?wd=${query}&tn=news&rtt=1&bsst=1`;

    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
        'Cookie': '',
      },
    }, 10000);

    if (!response.ok) return [];
    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];

    // 百度搜索结果
    $('div.result, .result-op, .c-container').each((i, el) => {
      if (i >= count) return false;
      const $el = $(el);
      const title = ($el.find('h3 a').text() || $el.find('.c-title a').text()).trim();
      const link = $el.find('h3 a, .c-title a').attr('href') || '';
      const snippet = ($el.find('.c-abstract, .c-span-last').text() || '').trim();
      const source = $el.find('.c-color-gray, .news-source span').first().text().trim();

      if (title && title.length > 3) {
        results.push({
          title: title.replace(/<[^>]+>/g, ''),
          url: link,
          snippet,
          source: source || '百度资讯',
          time: '',
          origin: 'web',
        });
      }
    });

    console.log(`  🔍 Baidu: ${results.length} results for "${keyword}"`);
    return results;
  } catch (err) {
    console.error('Baidu crawler error:', err.message);
    return [];
  }
}

/**
 * Google News RSS（可能需要科学上网，作为补充）
 */
export async function searchGoogleNewsRSS(keyword, count = 10) {
  try {
    const query = encodeURIComponent(keyword);
    const url = `https://news.google.com/rss/search?q=${query}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;

    const response = await fetchWithTimeout(url, {
      headers: { 'User-Agent': randomUA() },
    }, 8000);

    if (!response.ok) return [];
    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const results = [];

    $('item').each((i, el) => {
      if (i >= count) return false;
      const $el = $(el);
      const title = $el.find('title').text().trim();
      const link = $el.find('link').text().trim();
      const pubDate = $el.find('pubDate').text().trim();
      const source = $el.find('source').text().trim();

      if (title) {
        results.push({
          title,
          url: link,
          snippet: '',
          source: source || 'Google News',
          time: pubDate,
          origin: 'web',
        });
      }
    });

    console.log(`  🔍 Google News RSS: ${results.length} results for "${keyword}"`);
    return results;
  } catch (err) {
    console.error('Google News RSS error:', err.message);
    return [];
  }
}

/**
 * 统一搜索入口: 从多个搜索引擎采集（容错，任一成功即有数据）
 */
export async function crawlWeb(keyword) {
  const [bingResults, sogouResults, baiduResults, googleResults] = await Promise.allSettled([
    searchBing(keyword),
    searchSogou(keyword),
    searchBaidu(keyword),
    searchGoogleNewsRSS(keyword),
  ]);

  const allResults = [];
  const seenTitles = new Set();

  const addResults = (settled) => {
    if (settled.status !== 'fulfilled') return;
    for (const item of settled.value) {
      const key = item.title.toLowerCase().slice(0, 30);
      if (!seenTitles.has(key)) {
        seenTitles.add(key);
        allResults.push(item);
      }
    }
  };

  addResults(bingResults);
  addResults(sogouResults);
  addResults(baiduResults);
  addResults(googleResults);

  console.log(`  🌐 Web crawl total: ${allResults.length} unique results for "${keyword}"`);
  return allResults;
}
