const TWITTER_API_BASE = 'https://api.twitterapi.io';

/**
 * Twitter/X 高级搜索
 */
export async function searchTwitter(keyword, apiKey, queryType = 'Latest') {
  if (!apiKey) {
    console.warn('Twitter API key not configured, skipping Twitter search');
    return [];
  }

  try {
    const query = encodeURIComponent(keyword);
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

    return data.tweets.map(tweet => ({
      title: tweet.text?.slice(0, 100) || '',
      snippet: tweet.text || '',
      url: tweet.url || `https://twitter.com/${tweet.author?.username}/status/${tweet.id}`,
      source: `@${tweet.author?.username || 'unknown'}`,
      time: tweet.createdAt || '',
      origin: 'twitter',
      engagement: {
        likes: tweet.likeCount || 0,
        retweets: tweet.retweetCount || 0,
        replies: tweet.replyCount || 0,
        views: tweet.viewCount || 0,
      },
      author: {
        name: tweet.author?.name || '',
        username: tweet.author?.username || '',
        verified: tweet.author?.verified || false,
      },
    }));
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
