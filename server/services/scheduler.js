import cron from 'node-cron';
import { crawlWeb } from './crawler.js';
import { searchTwitter } from './twitter.js';
import { fetchRSSFeeds } from './rss.js';
import { analyzeAndDedupe } from './ai.js';
import { queryAll, runSql, queryOne } from '../db/init.js';
import { sendNotification, notifyWebSocket } from './notifier.js';

let cronJob = null;
let cleanupJob = null;
let isScanning = false;
const SCAN_TIMEOUT_MS = 180000; // 180 seconds max scan time

/**
 * 执行一次完整的热点扫描（带超时保护）
 */
export async function runScan() {
  if (isScanning) {
    console.log('⏳ Scan already in progress, skipping...');
    return { status: 'skipped', reason: 'already running' };
  }

  isScanning = true;
  const startTime = Date.now();

  // 超时保护：180s 后自动释放锁
  const timeoutGuard = setTimeout(() => {
    if (isScanning) {
      console.error('⚠️ Scan timeout after 180s, force releasing lock');
      isScanning = false;
      notifyWebSocket('scan-progress', { status: 'error', message: 'Scan timeout' });
    }
  }, SCAN_TIMEOUT_MS);

  const scanLog = { web: 0, twitter: 0, rss: 0, keywords: 0, newItems: 0 };
  notifyWebSocket('scan-progress', { status: 'started' });
  console.log('🔍 Starting hot topic scan...');

  try {
    const keywords = queryAll("SELECT * FROM keywords WHERE enabled = 1");

    if (keywords.length === 0) {
      console.log('⚠️ No enabled keywords, skipping scan');
      notifyWebSocket('scan-progress', { status: 'no_keywords' });
      isScanning = false;
      clearTimeout(timeoutGuard);
      return { status: 'no_keywords', reason: 'no enabled keywords' };
    }

    const apiKey = queryOne("SELECT value FROM settings WHERE key = 'openrouter_api_key'")?.value || process.env.OPENROUTER_API_KEY;
    const aiModel = queryOne("SELECT value FROM settings WHERE key = 'ai_model'")?.value || '';
    const twitterKey = process.env.TWITTER_API_KEY || queryOne("SELECT value FROM settings WHERE key = 'twitter_api_key'")?.value;
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

      // 新鲜度过滤：丢弃发布时间超过 10 天或无时间戳的热点
      const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const freshResults = allResults.filter(item => {
        if (!item.time) return false; // 无时间戳的丢弃
        const t = new Date(item.time);
        if (isNaN(t.getTime())) return false; // 无法解析的丢弃
        return (now - t.getTime()) <= TEN_DAYS_MS;
      });

      console.log(`  📰 "${kw.keyword}": found ${allResults.length} raw, ${freshResults.length} within 10 days`);

      if (freshResults.length === 0) continue;

      // AI 分析 + 逐条实时推送
      const onItemReady = async (item) => {
        // 按 title+source 或 source_url 去重
        const existing = queryOne(
          "SELECT id FROM hotspots WHERE (title = ? AND source = ?) OR (source_url = ? AND source_url != '')",
          [item.title, item.source, item.url || '']
        );
        if (existing) return;

        // Normalize published_at to ISO format for proper sorting
        const rawTime = item.time || new Date().toISOString();
        let publishedAt;
        try {
          const d = new Date(rawTime);
          publishedAt = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
        } catch {
          publishedAt = new Date().toISOString();
        }

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
            publishedAt,
          ]
        );

        totalNew++;

        // 实时推送新热点到前端
        notifyWebSocket('new_hotspot', {
          id: result.lastId,
          title: item.title,
          summary: item.summary || '',
          source: item.origin || item.source,
          source_url: item.url || '',
          keyword_id: kw.id,
          keyword_text: kw.keyword,
          heat_score: item.heat_score || 0,
          is_verified: item.is_verified || 0,
          ai_analysis: item.ai_analysis || '',
          raw_data: JSON.stringify(item),
          published_at: item.time || new Date().toISOString(),
        });

        if (kw.type === 'keyword') {
          await sendNotification({ id: result.lastId, title: item.title, summary: item.summary, source: item.source, source_url: item.url, heat_score: item.heat_score, is_verified: item.is_verified }, emailSettings);
          runSql("INSERT INTO notifications (hotspot_id, type, status, sent_at) VALUES (?, 'ws', 'sent', datetime('now'))", [result.lastId]);
        }
      };

      const analyzed = await analyzeAndDedupe(freshResults, kw.keyword, apiKey, aiModel, { onItemReady });
      console.log(`  🤖 "${kw.keyword}": AI passed ${analyzed.length}/${freshResults.length} items`);
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
    clearTimeout(timeoutGuard);
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

/**
 * 清理超过10天的旧热点（按 published_at 发布时间判断）
 */
export function cleanOldHotspots() {
  const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  // 查询所有热点的 id 和 published_at，用 JS 解析时间（兼容各种格式）
  const allRows = queryAll("SELECT id, published_at FROM hotspots");
  const toDelete = [];

  for (const row of allRows) {
    if (!row.published_at) { toDelete.push(row.id); continue; }
    const t = new Date(row.published_at);
    if (isNaN(t.getTime())) { toDelete.push(row.id); continue; }
    if ((now - t.getTime()) > TEN_DAYS_MS) { toDelete.push(row.id); }
  }

  if (toDelete.length === 0) {
    console.log('🧹 Daily cleanup: no hotspots older than 10 days');
    return { deleted: 0 };
  }

  // 分批删除
  const BATCH = 500;
  for (let i = 0; i < toDelete.length; i += BATCH) {
    const batch = toDelete.slice(i, i + BATCH);
    const placeholders = batch.map(() => '?').join(',');
    runSql(`DELETE FROM notifications WHERE hotspot_id IN (${placeholders})`, batch);
    runSql(`DELETE FROM hotspots WHERE id IN (${placeholders})`, batch);
  }

  console.log(`🧹 Daily cleanup: deleted ${toDelete.length} hotspots older than 10 days`);
  return { deleted: toDelete.length };
}

/**
 * 启动每日清理定时任务（北京时间 00:00:01）
 */
export function startCleanupScheduler() {
  if (cleanupJob) cleanupJob.stop();

  // cron: 秒 分 时 日 月 星期 → 每天 00:00:01
  cleanupJob = cron.schedule('1 0 0 * * *', () => {
    console.log('⏰ Daily cleanup triggered (00:00:01 Beijing time)');
    cleanOldHotspots();
  }, {
    timezone: 'Asia/Shanghai'
  });

  console.log('📅 Cleanup scheduler started: daily at 00:00:01 (Beijing time)');
}
