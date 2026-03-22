import cron from 'node-cron';
import { crawlWeb } from './crawler.js';
import { searchTwitter } from './twitter.js';
import { fetchRSSFeeds } from './rss.js';
import { analyzeAndDedupe } from './ai.js';
import { queryAll, runSql, queryOne } from '../db/init.js';
import { sendNotification, notifyWebSocket } from './notifier.js';

let cronJob = null;
let isScanning = false;

/**
 * 执行一次完整的热点扫描
 */
export async function runScan() {
  if (isScanning) {
    console.log('⏳ Scan already in progress, skipping...');
    return { status: 'skipped', reason: 'already running' };
  }

  isScanning = true;
  const startTime = Date.now();
  const scanLog = { web: 0, twitter: 0, rss: 0, keywords: 0, newItems: 0 };
  notifyWebSocket('scan-progress', { status: 'started' });
  console.log('🔍 Starting hot topic scan...');

  try {
    const keywords = queryAll("SELECT * FROM keywords WHERE enabled = 1");
    const apiKey = queryOne("SELECT value FROM settings WHERE key = 'openrouter_api_key'")?.value || process.env.OPENROUTER_API_KEY;
    const aiModel = queryOne("SELECT value FROM settings WHERE key = 'ai_model'")?.value || '';
    const twitterKey = process.env.TWITTER_API_KEY;
    const emailSettings = {
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
      NOTIFY_EMAIL: process.env.NOTIFY_EMAIL,
    };

    scanLog.keywords = keywords.length;
    console.log(`  📋 Keywords: ${keywords.map(k => k.keyword).join(', ')} | API key: ${apiKey ? 'configured' : '⚠️ MISSING'}`);

    let totalNew = 0;

    for (const kw of keywords) {
      notifyWebSocket('scan-progress', { status: 'scanning', keyword: kw.keyword });

      // 多源并行抓取
      const [webResults, twitterResults, rssResults] = await Promise.allSettled([
        crawlWeb(kw.keyword),
        searchTwitter(kw.keyword, twitterKey),
        fetchRSSFeeds(kw.keyword),
      ]);

      const web = webResults.status === 'fulfilled' ? webResults.value : [];
      const twitter = twitterResults.status === 'fulfilled' ? twitterResults.value : [];
      const rss = rssResults.status === 'fulfilled' ? rssResults.value : [];

      if (webResults.status === 'rejected') console.error(`  ❌ Web crawl failed for "${kw.keyword}":`, webResults.reason?.message);
      if (twitterResults.status === 'rejected') console.error(`  ❌ Twitter search failed for "${kw.keyword}":`, twitterResults.reason?.message);
      if (rssResults.status === 'rejected') console.error(`  ❌ RSS fetch failed for "${kw.keyword}":`, rssResults.reason?.message);

      scanLog.web += web.length;
      scanLog.twitter += twitter.length;
      scanLog.rss += rss.length;

      console.log(`  📊 "${kw.keyword}" sources: web=${web.length}, twitter=${twitter.length}, rss=${rss.length}`);

      const allResults = [...web, ...twitter, ...rss];

      console.log(`  📰 "${kw.keyword}": found ${allResults.length} raw results`);

      if (allResults.length === 0) continue;

      // AI 分析与去重
      const analyzed = await analyzeAndDedupe(allResults, kw.keyword, apiKey, aiModel);
      console.log(`  🤖 "${kw.keyword}": AI passed ${analyzed.length}/${allResults.length} items`);

      // 存入数据库（去重：同标题不重复入库）
      for (const item of analyzed) {
        const existing = queryOne(
          "SELECT id FROM hotspots WHERE title = ? AND source = ?",
          [item.title, item.source]
        );

        if (!existing) {
          const result = runSql(
            `INSERT INTO hotspots (title, summary, source, source_url, keyword_id, heat_score, is_verified, ai_analysis, raw_data, published_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              item.title,
              item.summary || '',
              item.origin || item.source,
              item.url || '',
              kw.id,
              item.heat_score || 0,
              item.is_verified || 0,
              item.ai_analysis || '',
              JSON.stringify(item),
              item.time || new Date().toISOString(),
            ]
          );

          totalNew++;

          // 关键词命中通知
          if (kw.type === 'keyword') {
            const hotspotData = {
              id: result.lastId,
              title: item.title,
              summary: item.summary,
              source: item.source,
              source_url: item.url,
              heat_score: item.heat_score,
              is_verified: item.is_verified,
            };
            notifyWebSocket('keyword-hit', { keyword: kw.keyword, hotspot: hotspotData });
            await sendNotification(hotspotData, emailSettings);

            // 记录通知
            runSql(
              "INSERT INTO notifications (hotspot_id, type, status, sent_at) VALUES (?, 'ws', 'sent', datetime('now'))",
              [result.lastId]
            );
          }
        }
      }
    }

    notifyWebSocket('scan-progress', { status: 'completed', newItems: totalNew });
    const duration = Date.now() - startTime;
    console.log(`✅ Scan completed in ${(duration / 1000).toFixed(1)}s. ${totalNew} new hotspots found. (web=${scanLog.web}, twitter=${scanLog.twitter}, rss=${scanLog.rss})`);

    // 记录扫描日志
    runSql(
      `INSERT INTO scan_logs (status, keywords_scanned, new_items, web_count, twitter_count, rss_count, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['completed', scanLog.keywords, totalNew, scanLog.web, scanLog.twitter, scanLog.rss, duration]
    );

    return { status: 'completed', newItems: totalNew };
  } catch (err) {
    console.error('Scan error:', err);
    const duration = Date.now() - startTime;
    notifyWebSocket('scan-progress', { status: 'error', message: err.message });

    runSql(
      `INSERT INTO scan_logs (status, keywords_scanned, new_items, web_count, twitter_count, rss_count, error_message, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['error', scanLog.keywords, scanLog.newItems, scanLog.web, scanLog.twitter, scanLog.rss, err.message, duration]
    );

    return { status: 'error', message: err.message };
  } finally {
    isScanning = false;
  }
}

/**
 * 启动定时任务
 */
export function startScheduler(intervalMinutes = 30) {
  if (cronJob) cronJob.stop();

  // node-cron: 每隔 N 分钟执行
  const cronExpr = `*/${intervalMinutes} * * * *`;
  cronJob = cron.schedule(cronExpr, () => {
    console.log(`⏰ Scheduled scan triggered (every ${intervalMinutes}min)`);
    runScan();
  });

  console.log(`📅 Scheduler started: every ${intervalMinutes} minutes`);
}

export function stopScheduler() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('📅 Scheduler stopped');
  }
}
