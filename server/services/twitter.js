const TWITTER_API_BASE = 'https://api.twitterapi.io';

// 硬性过滤门槛
const MIN_LIKES = 50;
const MIN_RETWEETS = 20;
const MIN_VIEWS = 2000;
const MIN_TEXT_LENGTH = 100;

/**
 * Twitter/X 高级搜索（含质量过滤）
 */
export async function searchTwitter(keyword, apiKey, queryType = 'Top') {
  if (!apiKey) {
    console.warn('Twitter API key not configured, skipping Twitter search');
    return [];
  }

  try {
    // 搜索语法：排除回复和引用，只保留原创推文
    const rawQuery = `${keyword} -filter:replies -filter:quote_tweets`;
    const query = encodeURIComponent(rawQuery);
    const url = `${TWITTER_API_BASE}/twitter/tweet/advanced_search?query=${query}&queryType=${queryType}`;

    const response = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Twitter API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();

    if (!data.tweets || !Array.isArray(data.tweets)) {
      return [];
    }

    const rawCount = data.tweets.length;

    // 质量过滤 + 映射
    const filtered = data.tweets
      .filter(tweet => {
        const text = tweet.text || '';
        const likes = tweet.likeCount || 0;
        const retweets = tweet.retweetCount || 0;
        const views = tweet.viewCount || 0;

        // 过滤纯回复（以 @ 开头）
        if (text.trimStart().startsWith('@')) return false;
        // 过滤内容太短的推文
        if (text.length < MIN_TEXT_LENGTH) return false;
        // 硬性互动门槛
        if (likes < MIN_LIKES) return false;
        if (retweets < MIN_RETWEETS) return false;
        if (views < MIN_VIEWS) return false;

        return true;
      })
      .map(tweet => {
        const likes = tweet.likeCount || 0;
        const retweets = tweet.retweetCount || 0;
        const replies = tweet.replyCount || 0;
        const views = tweet.viewCount || 1;
        const verified = tweet.author?.verified || false;

        // 互动率：(likes + retweets + replies) / views
        const engagementRate = (likes + retweets + replies) / views;
        // 综合质量分：互动率加权 + 认证作者加分
        const qualityScore = engagementRate * 1000 + (verified ? 50 : 0);

        return {
          title: tweet.text?.slice(0, 100) || '',
          snippet: tweet.text || '',
          url: tweet.url || `https://twitter.com/${tweet.author?.username}/status/${tweet.id}`,
          source: `@${tweet.author?.username || 'unknown'}`,
          time: tweet.createdAt || '',
          origin: 'twitter',
          engagement: { likes, retweets, replies, views },
          engagementRate: Math.round(engagementRate * 10000) / 100, // 百分比
          qualityScore: Math.round(qualityScore * 100) / 100,
          author: {
            name: tweet.author?.name || '',
            username: tweet.author?.username || '',
            verified,
          },
        };
      })
      // 按质量分降序排列
      .sort((a, b) => b.qualityScore - a.qualityScore);

    console.log(`  🐦 Twitter: ${filtered.length}/${rawCount} tweets passed quality filter for "${keyword}"`);
    return filtered;
  } catch (err) {
    console.error('Twitter search error:', err.message);
    return [];
  }
}

/**
 * 获取指定用户最新推文
 */
export async function getUserTweets(username, apiKey) {
  if (!apiKey) return [];

  try {
    const url = `${TWITTER_API_BASE}/twitter/user/last_tweets?userName=${encodeURIComponent(username)}`;

    const response = await fetch(url, {
      headers: { 'x-api-key': apiKey },
    });

    if (!response.ok) return [];
    const data = await response.json();

    return (data.tweets || []).map(tweet => ({
      title: tweet.text?.slice(0, 100) || '',
      snippet: tweet.text || '',
      url: tweet.url || '',
      source: `@${username}`,
      time: tweet.createdAt || '',
      origin: 'twitter',
      engagement: {
        likes: tweet.likeCount || 0,
        retweets: tweet.retweetCount || 0,
        replies: tweet.replyCount || 0,
        views: tweet.viewCount || 0,
      },
    }));
  } catch (err) {
    console.error(`Twitter user tweets error (${username}):`, err.message);
    return [];
  }
}
