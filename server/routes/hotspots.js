import { Router } from 'express';
import { queryAll, queryOne } from '../db/init.js';
import { runScan } from '../services/scheduler.js';

const router = Router();

// 获取热点列表（分页 + 筛选 + 排序）
router.get('/', (req, res) => {
  const { page = 1, limit = 20, keyword_id, source, min_score, max_score, verified_only, search, sort, time_range, has_url } = req.query;
  const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

  let sql = "SELECT h.*, k.keyword as keyword_text FROM hotspots h LEFT JOIN keywords k ON h.keyword_id = k.id WHERE 1=1";
  const params = [];

  if (search) {
    sql += " AND (h.title LIKE ? OR h.summary LIKE ?)";
    const pattern = `%${search}%`;
    params.push(pattern, pattern);
  }
  if (keyword_id) {
    const ids = keyword_id.split(',').map(Number).filter(n => !isNaN(n) && n > 0);
    if (ids.length) {
      sql += ` AND h.keyword_id IN (${ids.map(() => '?').join(',')})`;
      params.push(...ids);
    }
  }
  if (source) {
    const sources = source.split(',').map(s => s.trim()).filter(Boolean);
    if (sources.length) {
      sql += ` AND h.source IN (${sources.map(() => '?').join(',')})`;
      params.push(...sources);
    }
  }
  if (min_score) {
    sql += " AND h.heat_score >= ?";
    params.push(Number(min_score));
  }
  if (max_score) {
    sql += " AND h.heat_score <= ?";
    params.push(Number(max_score));
  }
  if (verified_only === '1') {
    sql += " AND h.is_verified = 1";
  }
  if (has_url === '1') {
    sql += " AND h.source_url IS NOT NULL AND h.source_url != ''";
  }
  if (time_range && time_range !== 'all') {
    const now = new Date();
    const chinaOffset = 8 * 60 * 60 * 1000;
    const chinaNow = new Date(now.getTime() + chinaOffset);
    let daysBack = 0;
    if (time_range === 'today') daysBack = 0;
    else if (time_range === '3days') daysBack = 2;
    else if (time_range === '7days') daysBack = 6;
    const cutoffChina = new Date(Date.UTC(chinaNow.getUTCFullYear(), chinaNow.getUTCMonth(), chinaNow.getUTCDate() - daysBack, 0, 0, 0));
    const cutoffUTC = new Date(cutoffChina.getTime() - chinaOffset);
    sql += " AND h.created_at >= ?";
    params.push(cutoffUTC.toISOString().replace('T', ' ').slice(0, 19));
  }

  // 总数
  const countSql = sql.replace("SELECT h.*, k.keyword as keyword_text", "SELECT COUNT(*) as total");
  const total = queryOne(countSql, params)?.total || 0;

  // 排序（sort 值仅作为 map key 查找，安全无注入风险）
  const sortOptions = {
    created_at: 'h.created_at DESC',
    published_at: 'COALESCE(h.published_at, h.created_at) DESC',
    heat_score: 'h.heat_score DESC, h.created_at DESC',
    confidence: "CAST(COALESCE(json_extract(h.ai_analysis, '$.confidence'), 0) AS REAL) DESC, h.created_at DESC",
    engagement: "(COALESCE(json_extract(h.raw_data, '$.engagement.likes'), 0) + COALESCE(json_extract(h.raw_data, '$.engagement.retweets'), 0) * 3 + COALESCE(json_extract(h.raw_data, '$.engagement.views'), 0) * 0.001) DESC, h.created_at DESC",
  };
  const orderBy = sortOptions[sort] || sortOptions.created_at;
  sql += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
  params.push(Number(limit), offset);

  const hotspots = queryAll(sql, params);
  res.json({
    data: hotspots,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
  });
});

// 手动触发一次扫描（异步执行，立即返回）
router.post('/refresh', (req, res) => {
  // 异步启动扫描，不等待完成
  runScan().catch(err => console.error('Manual scan error:', err));
  res.json({ status: 'started' });
});

// 获取热点详情（动态路由放在具体路由之后）
router.get('/:id', (req, res) => {
  const hotspot = queryOne(
    "SELECT h.*, k.keyword as keyword_text FROM hotspots h LEFT JOIN keywords k ON h.keyword_id = k.id WHERE h.id = ?",
    [Number(req.params.id)]
  );
  if (!hotspot) return res.status(404).json({ error: '热点不存在' });
  res.json({ data: hotspot });
});

// 获取统计数据
router.get('/stats/overview', (req, res) => {
  const totalHotspots = queryOne("SELECT COUNT(*) as count FROM hotspots")?.count || 0;
  
  // Compute today's date range in China time (UTC+8) using JavaScript
  const now = new Date();
  const chinaOffset = 8 * 60 * 60 * 1000;
  const chinaDate = new Date(now.getTime() + chinaOffset);
  const todayStr = chinaDate.toISOString().slice(0, 10); // YYYY-MM-DD
  // created_at is stored via SQLite CURRENT_TIMESTAMP (UTC), so convert to UTC+8 for comparison
  const todayHotspots = queryOne(
    "SELECT COUNT(*) as count FROM hotspots WHERE substr(datetime(created_at, '+8 hours'), 1, 10) = ?",
    [todayStr]
  )?.count || 0;
  const avgScore = queryOne("SELECT AVG(heat_score) as avg FROM hotspots")?.avg || 0;
  const topSources = queryAll(
    "SELECT source, COUNT(*) as count FROM hotspots GROUP BY source ORDER BY count DESC LIMIT 5"
  );
  const keywordCount = queryOne("SELECT COUNT(*) as count FROM keywords WHERE enabled = 1")?.count || 0;

  res.json({
    data: {
      totalHotspots,
      todayHotspots,
      avgScore: Math.round(avgScore * 10) / 10,
      topSources,
      keywordCount,
    },
  });
});

// 获取扫描日志（最近 20 条）
router.get('/stats/scan-logs', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const logs = queryAll(
    "SELECT * FROM scan_logs ORDER BY created_at DESC LIMIT ?",
    [limit]
  );
  res.json({ data: logs });
});

export default router;
