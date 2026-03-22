import { Router } from 'express';
import { queryAll, queryOne, runSql } from '../db/init.js';

const router = Router();

// 获取所有设置
router.get('/', (req, res) => {
  const rows = queryAll("SELECT * FROM settings");
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  res.json({ data: settings });
});

// 更新设置
router.put('/', (req, res) => {
  const updates = req.body;

  // 允许更新的设置项白名单
  const allowedKeys = [
    'scan_interval', 'notify_email', 'notify_browser_push',
    'notify_websocket', 'openrouter_api_key',
    'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass',
  ];

  for (const [key, value] of Object.entries(updates)) {
    if (!allowedKeys.includes(key)) continue;

    const existing = queryOne("SELECT key FROM settings WHERE key = ?", [key]);
    if (existing) {
      runSql("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ?", [String(value), key]);
    } else {
      runSql("INSERT INTO settings (key, value) VALUES (?, ?)", [key, String(value)]);
    }
  }

  // 返回更新后的设置
  const rows = queryAll("SELECT * FROM settings");
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  res.json({ data: settings });
});

export default router;
