import * as cheerio from 'cheerio';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
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
    }, 15000);

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
 * Google News RSS（国际新闻源）
 */
export async function searchGoogleNewsRSS(keyword, count = 10) {
  try {
    const query = encodeURIComponent(keyword);
    const url = `https://news.google.com/rss/search?q=${query}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;

    const response = await fetchWithTimeout(url, {
      headers: { 'User-Agent': randomUA() },
    }, 15000);

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
 * DuckDuckGo HTML Lite 新闻搜索（独立索引，轻量易抓取）
 */
export async function searchDuckDuckGo(keyword, count = 10) {
  try {
    const query = encodeURIComponent(`${keyword} AI news`);
    const url = `https://html.duckduckgo.com/html/?q=${query}`;

    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
        'Accept': 'text/html,application/xhtml+xml',
      },
    }, 15000);

    if (!response.ok) {
      console.error(`DuckDuckGo search failed: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];

    // DuckDuckGo HTML Lite result selectors
    $('div.result, .web-result').each((i, el) => {
      if (i >= count) return false;
      const $el = $(el);
      const title = ($el.find('a.result__a').text() || $el.find('h2 a').text()).trim();
      const link = $el.find('a.result__a').attr('href') || $el.find('h2 a').attr('href') || '';
      const snippet = ($el.find('.result__snippet').text() || $el.find('a.result__snippet').text()).trim();

      if (title && title.length > 5) {
        // DuckDuckGo 链接可能经过重定向编码
        let cleanUrl = link;
        if (link.includes('uddg=')) {
          try {
            const urlObj = new URL(link, 'https://duckduckgo.com');
            cleanUrl = urlObj.searchParams.get('uddg') || link;
          } catch { cleanUrl = link; }
        }

        results.push({
          title,
          url: cleanUrl.startsWith('http') ? cleanUrl : `https://duckduckgo.com${cleanUrl}`,
          snippet,
          source: 'DuckDuckGo',
          time: '',
          origin: 'web',
        });
      }
    });

    console.log(`  🔍 DuckDuckGo: ${results.length} results for "${keyword}"`);
    return results;
  } catch (err) {
    console.error('DuckDuckGo crawler error:', err.message);
    return [];
  }
}

/**
 * Brave Search 新闻搜索（独立索引，不依赖 Google/Bing）
 */
export async function searchBraveNews(keyword, count = 10) {
  try {
    const query = encodeURIComponent(`${keyword} AI`);
    const url = `https://search.brave.com/news?q=${query}&source=web`;

    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
        'Accept': 'text/html,application/xhtml+xml',
      },
    }, 15000);

    if (!response.ok) {
      console.error(`Brave search failed: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];

    // Brave News result selectors
    $('div.snippet, article.story').each((i, el) => {
      if (i >= count) return false;
      const $el = $(el);
      const title = ($el.find('a.result-header, .title').text() || $el.find('a').first().text()).trim();
      const link = $el.find('a.result-header').attr('href') || $el.find('a').first().attr('href') || '';
      const snippet = ($el.find('.snippet-description, .description').text() || '').trim();
      const source = $el.find('.netloc, .source').text().trim();
      const time = $el.find('.published-date, time').text().trim();

      if (title && title.length > 5) {
        results.push({
          title,
          url: link.startsWith('http') ? link : `https://search.brave.com${link}`,
          snippet,
          source: source || 'Brave News',
          time,
          origin: 'web',
        });
      }
    });

    // Fallback: 通用选择器
    if (results.length === 0) {
      $('a[href]').each((i, el) => {
        if (results.length >= count) return false;
        const $el = $(el);
        const title = $el.text().trim();
        const link = $el.attr('href') || '';

        // 只取外部链接，排除 Brave 自身链接
        if (title && title.length > 10 && link.startsWith('http') && !link.includes('brave.com')) {
          results.push({
            title: title.slice(0, 120),
            url: link,
            snippet: '',
            source: 'Brave News',
            time: '',
            origin: 'web',
          });
        }
      });
    }

    console.log(`  🔍 Brave News: ${results.length} results for "${keyword}"`);
    return results;
  } catch (err) {
    console.error('Brave crawler error:', err.message);
    return [];
  }
}

/**
 * B站搜索（公开 API，无需 API Key）
 * 频率限制：约 60 次/分钟（IP 级别），超过返回 -412
 * 逻辑：先搜用户，如命中则获取该 UP 主最新视频；否则按关键词搜视频
 */
export async function searchBilibili(keyword, count = 10) {
  try {
    const headers = {
      'User-Agent': randomUA(),
      'Referer': 'https://www.bilibili.com',
      'Accept': 'application/json',
    };

    // 1) 先搜用户，看关键词是否是 UP 主名称
    const userQuery = encodeURIComponent(keyword);
    const userUrl = `https://api.bilibili.com/x/web-interface/search/type?search_type=bili_user&keyword=${userQuery}&page=1`;
    const userRes = await fetchWithTimeout(userUrl, { headers }, 15000);
    const userData = await userRes.json();

    if (userData.code === 0 && userData.data?.result?.length > 0) {
      const topUser = userData.data.result[0];
      // 如果用户名高度匹配关键词，获取其最新视频
      const uname = topUser.uname || '';
      if (uname.toLowerCase().includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(uname.toLowerCase())) {
        const mid = topUser.mid;
        const spaceUrl = `https://api.bilibili.com/x/space/wbi/arc/search?mid=${mid}&ps=${count}&pn=1&order=pubdate`;
        const spaceRes = await fetchWithTimeout(spaceUrl, { headers }, 15000);
        const spaceData = await spaceRes.json();

        if (spaceData.code === 0 && spaceData.data?.list?.vlist?.length > 0) {
          const results = spaceData.data.list.vlist.slice(0, count).map(v => ({
            title: v.title,
            url: `https://www.bilibili.com/video/${v.bvid}`,
            snippet: v.description || '',
            source: `B站·${uname}`,
            time: v.created ? new Date(v.created * 1000).toISOString() : '',
            origin: 'bilibili',
          }));
          console.log(`  📺 Bilibili (UP主 ${uname}): ${results.length} videos`);
          return results;
        }
      }
    }

    // 2) 否则按关键词搜索视频
    const query = encodeURIComponent(keyword);
    const searchUrl = `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${query}&page=1&order=pubdate`;
    const searchRes = await fetchWithTimeout(searchUrl, { headers }, 15000);
    const searchData = await searchRes.json();

    if (searchData.code !== 0) {
      console.error(`Bilibili search error: code=${searchData.code} msg=${searchData.message}`);
      return [];
    }

    const results = (searchData.data?.result || []).slice(0, count).map(item => ({
      title: (item.title || '').replace(/<[^>]+>/g, ''),
      url: `https://www.bilibili.com/video/${item.bvid}`,
      snippet: item.description || '',
      source: item.author || 'B站',
      time: item.pubdate ? new Date(item.pubdate * 1000).toISOString() : '',
      origin: 'bilibili',
    }));

    console.log(`  📺 Bilibili: ${results.length} results for "${keyword}"`);
    return results;
  } catch (err) {
    console.error('Bilibili search error:', err.message);
    return [];
  }
}

/**
 * 微博搜索（移动端公开 API，无需 API Key / 登录）
 * 频率限制：约 30 次/分钟（IP 级别）
 * 逻辑：先搜用户，如命中则获取该用户最新微博；否则按关键词搜热门微博
 */
export async function searchWeibo(keyword, count = 10) {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Referer': 'https://m.weibo.cn/',
      'Accept': 'application/json, text/plain, */*',
      'X-Requested-With': 'XMLHttpRequest',
    };

    // 1) 搜索用户，看关键词是否是博主/官方账号
    const userContainerId = encodeURIComponent(`100103type=3&q=${keyword}`);
    const userUrl = `https://m.weibo.cn/api/container/getIndex?containerid=${userContainerId}&page_type=searchall`;
    const userRes = await fetchWithTimeout(userUrl, { headers }, 15000);
    const userData = await userRes.json();

    if (userData.ok === 1 && userData.data?.cards?.length > 0) {
      // 找到用户卡片
      for (const card of userData.data.cards) {
        const users = card.card_group || [];
        for (const u of users) {
          if (u.user) {
            const screenName = u.user.screen_name || '';
            if (screenName.toLowerCase().includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(screenName.toLowerCase())) {
              // 命中用户，获取其最新微博
              const uid = u.user.id;
              const profileContainerId = `107603${uid}`;
              const profileUrl = `https://m.weibo.cn/api/container/getIndex?type=uid&value=${uid}&containerid=${profileContainerId}`;
              const profileRes = await fetchWithTimeout(profileUrl, { headers }, 15000);
              const profileData = await profileRes.json();

              if (profileData.ok === 1 && profileData.data?.cards?.length > 0) {
                const results = [];
                for (const c of profileData.data.cards) {
                  if (results.length >= count) break;
                  const mblog = c.mblog;
                  if (!mblog) continue;
                  const text = (mblog.text || '').replace(/<[^>]+>/g, '').trim();
                  if (text.length < 20) continue;
                  results.push({
                    title: text.slice(0, 120),
                    url: `https://m.weibo.cn/detail/${mblog.id}`,
                    snippet: text,
                    source: `微博·${screenName}`,
                    time: mblog.created_at || '',
                    origin: 'weibo',
                    engagement: {
                      likes: mblog.attitudes_count || 0,
                      replies: mblog.comments_count || 0,
                      retweets: mblog.reposts_count || 0,
                    },
                  });
                }
                console.log(`  📱 Weibo (用户 ${screenName}): ${results.length} posts`);
                return results;
              }
            }
          }
        }
      }
    }

    // 2) 按关键词搜索热门微博
    const containerId = encodeURIComponent(`100103type=1&q=${keyword}`);
    const searchUrl = `https://m.weibo.cn/api/container/getIndex?containerid=${containerId}&page_type=searchall`;
    const searchRes = await fetchWithTimeout(searchUrl, { headers }, 15000);
    const searchData = await searchRes.json();

    if (searchData.ok !== 1) {
      console.error('Weibo search failed:', JSON.stringify(searchData).slice(0, 200));
      return [];
    }

    const results = [];
    for (const card of (searchData.data?.cards || [])) {
      if (results.length >= count) break;
      const mblog = card.mblog;
      if (!mblog) continue;
      const text = (mblog.text || '').replace(/<[^>]+>/g, '').trim();
      if (text.length < 20) continue;
      const author = mblog.user?.screen_name || '';
      results.push({
        title: text.slice(0, 120),
        url: `https://m.weibo.cn/detail/${mblog.id}`,
        snippet: text,
        source: author ? `微博·${author}` : '微博',
        time: mblog.created_at || '',
        origin: 'weibo',
        engagement: {
          likes: mblog.attitudes_count || 0,
          replies: mblog.comments_count || 0,
          retweets: mblog.reposts_count || 0,
        },
      });
    }

    console.log(`  📱 Weibo: ${results.length} results for "${keyword}"`);
    return results;
  } catch (err) {
    console.error('Weibo search error:', err.message);
    return [];
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 统一搜索入口: 串行从多个搜索引擎采集（避免并发过多导致网络拥堵）
 * 数据源：Bing + Google News RSS + DuckDuckGo + Brave Search + Bilibili + Weibo
 */
export async function crawlWeb(keyword) {
  const allResults = [];
  const seenTitles = new Set();

  const addResults = (items) => {
    for (const item of items) {
      const key = item.title.toLowerCase().slice(0, 30);
      if (!seenTitles.has(key)) {
        seenTitles.add(key);
        allResults.push(item);
      }
    }
  };

  // 第1组：Bing + Google News 并发
  const group1 = await Promise.allSettled([
    searchBing(keyword),
    searchGoogleNewsRSS(keyword),
  ]);
  for (const r of group1) {
    if (r.status === 'fulfilled') addResults(r.value);
  }

  // 间隔 2 秒，避免网络拥堵
  await sleep(2000);

  // 第2组：DuckDuckGo + Brave 并发
  const group2 = await Promise.allSettled([
    searchDuckDuckGo(keyword),
    searchBraveNews(keyword),
  ]);
  for (const r of group2) {
    if (r.status === 'fulfilled') addResults(r.value);
  }

  // 间隔 2 秒，避免被限频
  await sleep(2000);

  // 第3组：B站 + 微博 并发（国内源）
  const group3 = await Promise.allSettled([
    searchBilibili(keyword),
    searchWeibo(keyword),
  ]);
  for (const r of group3) {
    if (r.status === 'fulfilled') addResults(r.value);
  }

  console.log(`  🌐 Web crawl total: ${allResults.length} unique results for "${keyword}"`);
  return allResults;
}
