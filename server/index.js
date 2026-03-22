import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

import { initDatabase } from './db/init.js';
import { setWss } from './services/notifier.js';
import { startScheduler, startCleanupScheduler, cleanOldHotspots } from './services/scheduler.js';

import keywordsRouter from './routes/keywords.js';
import hotspotsRouter from './routes/hotspots.js';
import notificationsRouter from './routes/notifications.js';
import settingsRouter from './routes/settings.js';

const PORT = process.env.PORT || 3000;

async function main() {
  // 初始化数据库
  await initDatabase();

  const app = express();
  const server = createServer(app);

  // 中间件
  app.use(cors());
  app.use(express.json());

  // API 路由
  app.use('/api/keywords', keywordsRouter);
  app.use('/api/hotspots', hotspotsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/settings', settingsRouter);

  // 健康检查
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 手动触发清理旧热点
  app.post('/api/cleanup', (req, res) => {
    const result = cleanOldHotspots();
    res.json({ status: 'ok', ...result });
  });

  // 生产环境: 服务前端静态文件
  app.use(express.static(join(__dirname, '..', 'client', 'dist')));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(join(__dirname, '..', 'client', 'dist', 'index.html'));
    }
  });

  // WebSocket
  const wss = new WebSocketServer({ server, path: '/ws' });
  setWss(wss);

  wss.on('connection', (ws) => {
    console.log('🔌 WebSocket client connected');
    ws.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));

    ws.on('error', console.error);
    ws.on('close', () => console.log('🔌 WebSocket client disconnected'));
  });

  // 从数据库读取扫描间隔，默认 180 分钟（3小时）
  const { queryOne: q } = await import('./db/init.js');
  const intervalSetting = q("SELECT value FROM settings WHERE key = 'scan_interval'");
  const scanInterval = parseInt(intervalSetting?.value) || 180;
  startScheduler(scanInterval);
  startCleanupScheduler();

  // 启动时立即执行一次清理
  cleanOldHotspots();

  server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║   🔥 LKB Hot Monitor Server         ║
║   http://localhost:${PORT}              ║
║   WebSocket: ws://localhost:${PORT}/ws  ║
╚══════════════════════════════════════╝
    `);
  });
}

main().catch(console.error);
