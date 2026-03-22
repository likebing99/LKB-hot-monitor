# LKB Hot Monitor — 技术方案文档

## 1. 技术架构总览

```
┌──────────────────────────────────────────────────────────┐
│                       Client (Browser)                    │
│              React + Vite + TailwindCSS                   │
│     ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │
│     │ 关键词管理 │  │ 热点时间线 │  │ 通知中心 + 设置页 │    │
│     └──────────┘  └──────────┘  └──────────────────┘    │
│              │ HTTP REST    │ WebSocket                   │
└──────────────┼──────────────┼────────────────────────────┘
               │              │
┌──────────────┼──────────────┼────────────────────────────┐
│              ▼              ▼         Server (Node.js)    │
│     ┌─────────────┐  ┌───────────┐                       │
│     │ Express API  │  │ WS Server │                       │
│     └──────┬──────┘  └─────┬─────┘                       │
│            │               │                              │
│     ┌──────▼───────────────▼──────┐                      │
│     │        Scheduler (30min)     │                      │
│     └──────┬───────────────┬──────┘                      │
│            │               │                              │
│   ┌────────▼────┐  ┌──────▼───────┐                     │
│   │ Data Sources │  │  AI Service  │                     │
│   │ • Web爬虫    │  │ (OpenRouter) │                     │
│   │ • Twitter/X  │  │ • 真假识别    │                     │
│   │ • RSS聚合    │  │ • 摘要生成    │                     │
│   └──────┬──────┘  │ • 热度评分    │                     │
│          │         └──────┬───────┘                      │
│          │                │                               │
│     ┌────▼────────────────▼────┐                         │
│     │     SQLite Database       │                         │
│     └──────────────────────────┘                         │
└──────────────────────────────────────────────────────────┘
```

## 2. 技术栈详情

### 2.1 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.x | UI 框架 |
| Vite | 6.x | 构建工具 |
| TailwindCSS | 4.x | 原子化 CSS |
| React Router | 7.x | 路由管理 |

### 2.2 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | 20+ | 运行时 |
| Express | 4.x | Web 框架 |
| ws | 8.x | WebSocket 服务 |
| better-sqlite3 | 11.x | SQLite 驱动 |
| node-cron | 3.x | 定时任务 |
| cheerio | 1.x | HTML 解析（爬虫） |
| rss-parser | 3.x | RSS 解析 |
| nodemailer | 6.x | 邮件发送 |
| dotenv | 16.x | 环境变量 |

### 2.3 外部服务

| 服务 | 端点 | 用途 |
|------|------|------|
| OpenRouter | https://openrouter.ai/api/v1/chat/completions | AI 分析 |
| TwitterAPI.io | https://api.twitterapi.io/ | Twitter 数据 |

## 3. 数据库设计（SQLite）

### keywords 表
```sql
CREATE TABLE keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'keyword',  -- 'keyword' | 'topic'
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### hotspots 表
```sql
CREATE TABLE hotspots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    summary TEXT,
    source TEXT NOT NULL,          -- 'web' | 'twitter' | 'rss'
    source_url TEXT,
    keyword_id INTEGER,
    heat_score INTEGER DEFAULT 0,  -- 1-10
    is_verified INTEGER DEFAULT 0, -- AI 验证是否真实
    ai_analysis TEXT,              -- AI 分析结果 JSON
    raw_data TEXT,                 -- 原始数据 JSON
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (keyword_id) REFERENCES keywords(id)
);
```

### notifications 表
```sql
CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hotspot_id INTEGER,
    type TEXT NOT NULL,            -- 'ws' | 'push' | 'email'
    status TEXT DEFAULT 'pending', -- 'pending' | 'sent' | 'failed'
    sent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hotspot_id) REFERENCES hotspots(id)
);
```

### settings 表
```sql
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 4. API 设计

### 4.1 关键词管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/keywords | 获取所有关键词 |
| POST | /api/keywords | 添加关键词 |
| PUT | /api/keywords/:id | 更新关键词 |
| DELETE | /api/keywords/:id | 删除关键词 |
| PUT | /api/keywords/:id/toggle | 启停关键词 |

### 4.2 热点管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/hotspots | 获取热点列表（分页+筛选） |
| GET | /api/hotspots/:id | 获取热点详情 |
| POST | /api/hotspots/refresh | 手动触发一次抓取 |

### 4.3 通知管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/notifications | 获取通知列表 |
| PUT | /api/notifications/:id/read | 标记已读 |

### 4.4 系统设置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/settings | 获取设置 |
| PUT | /api/settings | 更新设置 |

### 4.5 WebSocket

| 事件 | 方向 | 说明 |
|------|------|------|
| `new-hotspot` | Server → Client | 新热点推送 |
| `keyword-hit` | Server → Client | 关键词命中通知 |
| `scan-progress` | Server → Client | 扫描进度更新 |

## 5. 数据源对接

### 5.1 网页搜索爬虫
- 通过 Bing/Google 搜索结果页爬取
- 用 cheerio 解析 HTML
- 频率控制：每关键词间隔 5 秒
- User-Agent 轮换

### 5.2 Twitter/X API（twitterapi.io）
- 端点：`GET /twitter/tweet/advanced_search`
- 参数：query, queryType, cursor
- 返回：推文列表、用户信息、互动数据

### 5.3 RSS 聚合
- 预设 AI/科技类 RSS 源
- 使用 rss-parser 解析
- 按关键词/领域过滤

## 6. AI 服务对接（OpenRouter）

### 请求格式
```javascript
POST https://openrouter.ai/api/v1/chat/completions
Headers:
  Authorization: Bearer <OPENROUTER_API_KEY>
  Content-Type: application/json

Body:
{
  "model": "google/gemini-2.0-flash-001",
  "messages": [
    { "role": "system", "content": "你是一个AI热点分析专家..." },
    { "role": "user", "content": "分析以下新闻..." }
  ]
}
```

### AI 分析任务
1. **真假甄别** — 判断内容是否真实、来源是否可靠
2. **摘要生成** — 提取核心信息，生成中文摘要
3. **热度评分** — 综合来源数量、互动量、时效性评分 1-10
4. **去重合并** — 识别同一事件的不同报道

## 7. 项目结构

```
LKB-hot-monitor/
├── docs/
│   ├── PRD.md                # 需求文档
│   └── TECH.md               # 技术方案（本文件）
├── server/
│   ├── index.js              # Express + WebSocket 主入口
│   ├── package.json
│   ├── .env                  # API Keys
│   ├── db/
│   │   └── init.js           # SQLite 初始化与迁移
│   ├── routes/
│   │   ├── keywords.js       # 关键词 CRUD
│   │   ├── hotspots.js       # 热点查询
│   │   ├── settings.js       # 系统设置
│   │   └── notifications.js  # 通知管理
│   └── services/
│       ├── crawler.js        # 网页搜索爬虫
│       ├── twitter.js        # Twitter/X API 对接
│       ├── rss.js            # RSS 聚合
│       ├── ai.js             # OpenRouter AI 分析
│       ├── notifier.js       # 通知服务（WS/Push/邮件）
│       └── scheduler.js      # 30分钟定时任务调度
├── client/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── postcss.config.js
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── main.css
│       ├── components/
│       │   ├── Layout.jsx
│       │   ├── KeywordManager.jsx
│       │   ├── HotspotTimeline.jsx
│       │   ├── HotspotCard.jsx
│       │   ├── NotificationCenter.jsx
│       │   └── Settings.jsx
│       └── hooks/
│           ├── useWebSocket.js
│           └── useNotification.js
└── skills/                   # Agent Skills（第二阶段）
    ├── SKILL.md
    └── hot-monitor.js
```

## 8. 开发计划

| 阶段 | 步骤 | 内容 | 依赖 |
|------|------|------|------|
| 后端 | Step 1 | 项目初始化、依赖安装、SQLite 数据库 | 无 |
| 后端 | Step 2 | 多源数据抓取（爬虫 + Twitter + RSS） | Step 1 |
| 后端 | Step 3 | OpenRouter AI 分析服务 | Step 1 |
| 后端 | Step 4 | API 路由 + WebSocket + 定时调度 | Step 2, 3 |
| 前端 | Step 5 | Vite + React + Tailwind 项目初始化 | 无 |
| 前端 | Step 6 | 页面开发（极光赛博风 UI） | Step 5 |
| 前端 | Step 7 | WebSocket + 浏览器 Push 集成 | Step 6 |
| 联调 | Step 8 | 前后端联调、功能测试 | Step 4, 7 |
| 扩展 | Step 9 | Agent Skills 封装 | Step 8 |

## 9. 环境变量（.env）

```env
# OpenRouter AI
OPENROUTER_API_KEY=

# Twitter API (twitterapi.io)
TWITTER_API_KEY=

# 邮件通知（可选）
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
NOTIFY_EMAIL=

# 服务端口
PORT=3000
```
