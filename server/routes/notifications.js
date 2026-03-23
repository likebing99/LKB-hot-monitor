import { Router } from 'express';
import { queryAll, queryOne, runSql } from '../db/init.js';

const router = Router();

// 获取通知列表（排除无效 hotspot_id=0 的记录）
router.get('/', (req, res) => {
  const { page = 1, limit = 20, unread_only } = req.query;
  const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

  let where = "WHERE n.hotspot_id > 0";
  const params = [];

  if (unread_only === '1') {
    where += " AND n.is_read = 0";
  }

  const countSql = `SELECT COUNT(*) as total FROM notifications n ${where}`;
  const total = queryOne(countSql, params)?.total || 0;

  const sql = `
    SELECT n.*, h.title as hotspot_title, h.summary as hotspot_summary,
           h.heat_score, h.source_url
    FROM notifications n
    LEFT JOIN hotspots h ON n.hotspot_id = h.id
    ${where}
    ORDER BY n.created_at DESC LIMIT ? OFFSET ?
  `;
  params.push(Number(limit), offset);

  const notifications = queryAll(sql, params);
  const unreadCount = queryOne("SELECT COUNT(*) as count FROM notifications WHERE is_read = 0 AND hotspot_id > 0")?.count || 0;

  res.json({
    data: notifications,
    unreadCount,
    pagination: { page: Number(page), limit: Number(limit), total },
  });
});

// 标记已读
router.put('/:id/read', (req, res) => {
  runSql("UPDATE notifications SET is_read = 1 WHERE id = ?", [Number(req.params.id)]);
  res.json({ success: true });
});

// 全部标记已读
router.put('/read-all', (req, res) => {
  runSql("UPDATE notifications SET is_read = 1 WHERE is_read = 0");
  res.json({ success: true });
});

export default router;
