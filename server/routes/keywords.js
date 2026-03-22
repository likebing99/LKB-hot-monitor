import { Router } from 'express';
import { queryAll, queryOne, runSql } from '../db/init.js';

const router = Router();

// 获取所有关键词
router.get('/', (req, res) => {
  const keywords = queryAll("SELECT * FROM keywords ORDER BY created_at DESC");
  res.json({ data: keywords });
});

// 添加关键词
router.post('/', (req, res) => {
  const { keyword, type = 'keyword' } = req.body;
  if (!keyword || !keyword.trim()) {
    return res.status(400).json({ error: '关键词不能为空' });
  }

  // 检查重复
  const existing = queryOne("SELECT id FROM keywords WHERE keyword = ?", [keyword.trim()]);
  if (existing) {
    return res.status(409).json({ error: '关键词已存在' });
  }

  const validTypes = ['keyword', 'topic'];
  const result = runSql(
    "INSERT INTO keywords (keyword, type) VALUES (?, ?)",
    [keyword.trim(), validTypes.includes(type) ? type : 'keyword']
  );
  // Fetch the newly created keyword using the keyword text as fallback
  let newKw = queryOne("SELECT * FROM keywords WHERE id = ?", [result.lastId]);
  if (!newKw) {
    newKw = queryOne("SELECT * FROM keywords WHERE keyword = ?", [keyword.trim()]);
  }
  res.status(201).json({ data: newKw });
});

// 更新关键词
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { keyword, type } = req.body;

  const existing = queryOne("SELECT * FROM keywords WHERE id = ?", [Number(id)]);
  if (!existing) return res.status(404).json({ error: '关键词不存在' });

  if (keyword) {
    runSql("UPDATE keywords SET keyword = ?, updated_at = datetime('now') WHERE id = ?", [keyword.trim(), Number(id)]);
  }
  if (type && ['keyword', 'topic'].includes(type)) {
    runSql("UPDATE keywords SET type = ?, updated_at = datetime('now') WHERE id = ?", [type, Number(id)]);
  }

  const updated = queryOne("SELECT * FROM keywords WHERE id = ?", [Number(id)]);
  res.json({ data: updated });
});

// 删除关键词
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  runSql("DELETE FROM keywords WHERE id = ?", [Number(id)]);
  res.json({ success: true });
});

// 切换启停
router.put('/:id/toggle', (req, res) => {
  const { id } = req.params;
  const existing = queryOne("SELECT * FROM keywords WHERE id = ?", [Number(id)]);
  if (!existing) return res.status(404).json({ error: '关键词不存在' });

  const newEnabled = existing.enabled ? 0 : 1;
  runSql("UPDATE keywords SET enabled = ?, updated_at = datetime('now') WHERE id = ?", [newEnabled, Number(id)]);

  const updated = queryOne("SELECT * FROM keywords WHERE id = ?", [Number(id)]);
  res.json({ data: updated });
});

export default router;
