# API 对接参考文档（基于 MCP 最新获取）

> 本文档记录通过 MCP 获取的最新 API 使用方式，确保代码实现不过时。

## 1. OpenRouter API

### 端点
```
POST https://openrouter.ai/api/v1/chat/completions
```

### 认证
```
Authorization: Bearer <OPENROUTER_API_KEY>
Content-Type: application/json
```

### 请求示例（fetch）
```javascript
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemini-2.0-flash-001',
    messages: [
      { role: 'system', content: '你是一个AI热点分析专家...' },
      { role: 'user', content: '分析以下新闻...' }
    ],
    temperature: 0.7,
    max_tokens: 1000,
  }),
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

### 响应结构
```json
{
  "id": "chatcmpl-xxx",
  "choices": [{
    "index": 0,
    "message": { "role": "assistant", "content": "..." },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 50,
    "total_tokens": 150
  }
}
```

---

## 2. TwitterAPI.io

### 高级搜索端点
```
GET https://api.twitterapi.io/twitter/tweet/advanced_search
```

### 认证
```
x-api-key: <TWITTER_API_KEY>
```

### 参数
| 参数 | 类型 | 必须 | 说明 |
|------|------|------|------|
| query | string | 是 | 搜索关键词，支持高级语法如 `"AI" OR "GPT" since:2024-01-01` |
| queryType | string | 是 | `"Latest"` 或 `"Top"` |
| cursor | string | 否 | 分页游标，首页为空字符串 |

### 请求示例
```javascript
const response = await fetch(
  `https://api.twitterapi.io/twitter/tweet/advanced_search?query=${encodeURIComponent(query)}&queryType=Latest`,
  {
    headers: { 'x-api-key': twitterApiKey }
  }
);
const data = await response.json();
// data.tweets[] — 推文数组
// data.has_next_page — 是否有下一页
// data.next_cursor — 下一页游标
```

### 推文对象结构
```json
{
  "type": "tweet",
  "id": "1234567890",
  "url": "https://twitter.com/user/status/1234567890",
  "text": "推文内容",
  "retweetCount": 10,
  "replyCount": 5,
  "likeCount": 20,
  "viewCount": 1000,
  "createdAt": "Tue Dec 10 07:00:30 +0000 2024",
  "lang": "en",
  "author": {
    "name": "用户名",
    "username": "handle",
    "verified": true
  }
}
```

### 获取用户最新推文
```
GET https://api.twitterapi.io/twitter/user/last_tweets
```
参数：`userName` 或 `userId`，`cursor`，`includeReplies`

---

## 3. better-sqlite3（v12.x）

### 初始化
```javascript
const Database = require('better-sqlite3');
const db = new Database('data.db');
```

### 建表
```javascript
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE
  )
`);
```

### CRUD
```javascript
// 插入
const insert = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
const info = insert.run('John', 'john@example.com');
// info.changes = 1, info.lastInsertRowid = 1

// 查询单条
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(1);

// 查询多条
const users = db.prepare('SELECT * FROM users WHERE name LIKE ?').all('%John%');

// 更新
db.prepare('UPDATE users SET name = ? WHERE id = ?').run('Jane', 1);

// 删除
db.prepare('DELETE FROM users WHERE id = ?').run(1);
```

---

## 4. ws (WebSocket, v8.x)

### 服务端（与 Express 共享 HTTP 服务器）
```javascript
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import express from 'express';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// 广播
function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

wss.on('connection', ws => {
  ws.on('error', console.error);
  ws.on('message', data => { /* ... */ });
});

server.listen(3000);
```

---

## 5. TailwindCSS v4 + Vite（最新）

> **重要：v4 不需要 `tailwind.config.js` 和 `postcss.config.js`！**

### 安装
```bash
npm install tailwindcss @tailwindcss/vite
```

### vite.config.js
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

### CSS 入口（main.css）
```css
@import "tailwindcss";
```

---

## 6. Cheerio（v1.x）

### 加载与解析
```javascript
import * as cheerio from 'cheerio';

const $ = cheerio.load(htmlString);
const title = $('h1').text();
const link = $('a').attr('href');
const items = $('li').map((i, el) => $(el).text()).get();
```

---

## 7. Vite 开发代理配置

```javascript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
})
```
