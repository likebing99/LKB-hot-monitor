import { Router } from 'express';
import { queryAll, queryOne } from '../db/init.js';
import { runScan } from '../services/scheduler.js';

const router = Router();

// 获取热点列表（分页 + 筛选）
router.get('/', (req, res) => {
  const { page = 1, limit = 20, keyword_id, source, min_score, verified_only, search } = req.query;
  const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

  let sql = "SELECT h.*, k.keyword as keyword_text FROM hotspots h LEFT JOIN keywords k ON h.keyword_id = k.id WHERE 1=1";
  const params = [];

  if (search) {
    sql += " AND (h.title LIKE ? OR h.summary LIKE ?)";
    const pattern = `%${search}%`;
    params.push(pattern, pattern);
  }
  if (keyword_id) {
    sql += " AND h.keyword_id = ?";
    params.push(Number(keyword_id));
  }
  if (source) {
    sql += " AND h.source = ?";
    params.push(source);
  }
  if (min_score) {
    sql += " AND h.heat_score >= ?";
    params.push(Number(min_score));
  }
  if (verified_only === '1') {
    sql += " AND h.is_verified = 1";
  }

  // 总数
  const countSql = sql.replace("SELECT h.*, k.keyword as keyword_text", "SELECT COUNT(*) as total");
  const total = queryOne(countSql, params)?.total || 0;

  sql += " ORDER BY h.created_at DESC LIMIT ? OFFSET ?";
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

// 获取热点详情
router.get('/:id', (req, res) => {
  const hotspot = queryOne(
    "SELECT h.*, k.keyword as keyword_text FROM hotspots h LEFT JOIN keywords k ON h.keyword_id = k.id WHERE h.id = ?",
    [Number(req.params.id)]
  );
  if (!hotspot) return res.status(404).json({ error: '热点不存在' });
  res.json({ data: hotspot });
});

// 手动触发一次扫描（异步执行，立即返回）
router.post('/refresh', (req, res) => {
  // 异步启动扫描，不等待完成
  runScan().catch(err => console.error('Manual scan error:', err));
  res.json({ status: 'started' });
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
