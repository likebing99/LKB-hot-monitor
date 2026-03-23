# 🔥 李柯兵 AI 热点监控工具

> 自动监控 AI 领域热点动态，多源数据采集 + AI 智能分析，第一时间发现真实热点并推送通知。

## 项目简介

作为 AI 领域创作者，需要第一时间获取热点动态（大模型更新、重大发布、行业变化等）。本工具通过 **多源数据采集 + AI 智能审核** 的方式，自动化完成热点发现、真假甄别、热度评分和实时推送全流程。

**核心价值：** 从 6+ 数据源自动采集 → AI 分析过滤噪音 → 只推送真正值得关注的热点

---

## 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户层                                   │
│                                                                  │
│   ┌──────────────────────┐    ┌────────────────────────────┐    │
│   │   Web Dashboard       │    │   Agent Skill (Claude等)   │    │
│   │   React + Vite        │    │   自包含，零后端依赖        │    │
│   │   localhost:5173       │    │   Firecrawl + AI 分析      │    │
│   └──────────┬───────────┘    └────────────────────────────┘    │
│              │ HTTP / WebSocket                                   │
└──────────────┼───────────────────────────────────────────────────┘
               │
┌──────────────┼───────────────────────────────────────────────────┐
│              ▼                   服务层 (Node.js)                 │
│   ┌─────────────────┐    ┌──────────────┐                       │
│   │   Express API    │    │  WebSocket    │                       │
│   │   REST 接口       │    │  实时推送      │                       │
│   └────────┬────────┘    └──────┬───────┘                       │
│            │                     │                                │
│   ┌────────▼─────────────────────▼────────┐                     │
│   │          Scheduler (node-cron)         │                     │
│   │   ┌─────────┐  ┌──────────┐           │                     │
│   │   │ 定时扫描  │  │ 每日清理  │           │                     │
│   │   │ 180 分钟  │  │ 00:00:01 │           │                     │
│   │   └─────────┘  └──────────┘           │                     │
│   └────────┬──────────────────┬───────────┘                     │
│            │                  │                                   │
│   ┌────────▼────────┐  ┌─────▼──────────┐                      │
│   │   数据采集引擎    │  │   AI 分析引擎   │                      │
│   │                  │  │                 │                      │
│   │ • Bing 新闻      │  │ • 查询扩展      │                      │
│   │ • Google News    │  │ • 相关性判定     │                      │
│   │ • DuckDuckGo     │  │ • 真假甄别      │                      │
│   │ • Brave News     │  │ • 热度评分      │                      │
│   │ • B站 API        │  │ • 摘要生成      │                      │
│   │ • 微博 API       │  │ • 去重合并      │                      │
│   │ • Twitter API    │  │                 │                      │
│   │ • RSS 聚合       │  │ (OpenRouter)    │                      │
│   └────────┬────────┘  └─────┬──────────┘                      │
│            │                  │                                   │
│   ┌────────▼──────────────────▼───────────┐                     │
│   │          SQLite (sql.js)               │                     │
│   │  keywords │ hotspots │ notifications   │                     │
│   │  settings │ scan_logs                  │                     │
│   └───────────────────────────────────────┘                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 功能模块

### 🔍 多源数据采集

| 数据源 | 方式 | 需要 API Key |
|--------|------|:---:|
| Bing 新闻 | HTML 爬取 | ❌ |
| Google News | RSS XML 解析 | ❌ |
| DuckDuckGo | HTML 爬取 | ❌ |
| Brave News | HTML 爬取 | ❌ |
| B站 | 公开 API | ❌ |
| 微博 | 移动端公开 API | ❌ |
| Twitter/X | twitterapi.io | ✅ |
| RSS 聚合 | 10 个预设源 (TechCrunch, The Verge, 36Kr 等) | ❌ |

### 🤖 AI 智能分析

- **查询扩展 (Query Expansion)** —— 为每个关键词生成 5-8 个语义变体，提升召回率
- **相关性判定** —— direct / indirect / none 三级分类，过滤噪音
- **真假甄别** —— 识别标题党、谣言、段子，只保留真实新闻
- **热度评分** —— 1-10 分综合评分（来源权威性 + 互动量 + 时效性）
- **摘要生成** —— 自动生成中文摘要（≤100 字）
- **去重合并** —— 标题 + URL 双维度去重

### 📊 仪表盘 (Dashboard)

- 统计卡片：今日热点数 / 总热点数 / 平均热度 / 监控词数
- 7 维筛选：关键词 / 来源 / 时间范围 / 热度范围 / URL / 搜索 / 已验证
- 4 种排序：最新发布 / 最新收录 / 互动数据 / 相关性最高
- 实时 WebSocket 推送 + 60 秒轮询兜底
- 扫描状态指示器（推送中 / 推送完毕）

### 🔑 关键词管理

- 支持 4 种类型：通用关键词 / 领域 / 人物 / 产品
- 启停控制、批量管理
- 无启用关键词时扫描自动提示

### 🔔 通知系统

- WebSocket 实时推送（页面打开时）
- 邮件通知（heat_score ≥ 7 时触发）
- 通知中心：已读/未读管理、一键清空

### 🧩 Agent Skill

独立封装的 AI 热点监控技能，可用于 Claude Code / VS Code Copilot 等 Agent：

- **零依赖** —— 不需要启动后端服务
- **零 API Key** —— 默认使用免费公开源
- **自包含 AI** —— 利用 Agent 自身能力分析
- **本地持久化** —— JSON 文件存储关键词和结果

---

## 技术选型

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.x | UI 框架 |
| Vite | 8.x | 构建工具 |
| TailwindCSS | 4.x | 原子化 CSS |
| React Router | 7.x | 路由管理 |
| Framer Motion | 12.x | 动画效果 |
| Lucide React | 0.5x | 图标库 |

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | 20+ | 运行时 |
| Express | 4.x | Web 框架 |
| ws | 8.x | WebSocket 实时通信 |
| sql.js | 1.x | SQLite 数据库 (纯 JS, 零二进制依赖) |
| node-cron | 3.x | 定时任务调度 |
| cheerio | 1.x | HTML 解析 (爬虫) |
| rss-parser | 3.x | RSS 解析 |
| nodemailer | 6.x | 邮件通知 |
| node-fetch | 3.x | HTTP 请求 |

### 外部服务

| 服务 | 用途 |
|------|------|
| OpenRouter API | AI 分析 (默认模型: MiniMax M2.5) |
| twitterapi.io | Twitter 数据采集 (可选) |

---

## 项目结构

```
LKB-hot-monitor/
├── client/                          # 前端 (React + Vite)
│   ├── src/
│   │   ├── App.jsx                  # 路由配置
│   │   ├── main.jsx                 # 入口
│   │   ├── index.css                # 全局样式 (春绿主题)
│   │   ├── components/
│   │   │   ├── Layout.jsx           # 导航栏布局
│   │   │   └── ui/                  # UI 组件 (动效/背景)
│   │   ├── hooks/
│   │   │   └── useWebSocket.js      # WebSocket 自动重连
│   │   ├── lib/
│   │   │   └── api.js               # API 客户端
│   │   └── pages/
│   │       ├── Dashboard.jsx        # 仪表盘 (核心页面)
│   │       ├── Keywords.jsx         # 关键词管理
│   │       ├── Notifications.jsx    # 通知中心
│   │       └── Settings.jsx         # 系统设置
│   ├── package.json
│   └── vite.config.js
│
├── server/                          # 后端 (Node.js + Express)
│   ├── index.js                     # 主入口 (Express + WS)
│   ├── db/
│   │   └── init.js                  # SQLite 初始化与迁移
│   ├── routes/
│   │   ├── hotspots.js              # 热点 API
│   │   ├── keywords.js              # 关键词 CRUD
│   │   ├── notifications.js         # 通知管理
│   │   └── settings.js              # 系统设置
│   ├── services/
│   │   ├── ai.js                    # AI 分析引擎
│   │   ├── crawler.js               # 多源网页爬虫
│   │   ├── twitter.js               # Twitter API 对接
│   │   ├── rss.js                   # RSS 聚合
│   │   ├── notifier.js              # 通知服务 (WS + 邮件)
│   │   └── scheduler.js             # 定时扫描调度
│   ├── package.json
│   └── .env.example
│
├── skills/                          # Agent Skill (自包含)
│   └── hot-monitor/
│       ├── SKILL.md                 # 技能主文件
│       └── references/
│           ├── search-strategies.md # 数据源搜索策略
│           ├── analysis-prompts.md  # AI 分析模板
│           └── data-models.md       # 数据结构定义
│
├── docs/                            # 文档
│   ├── PRD.md                       # 产品需求文档
│   ├── TECH.md                      # 技术方案文档
│   └── API-REFERENCE.md             # API 对接参考
│
├── CHANGELOG.md                     # 更新日志
└── README.md                        # 项目说明 (本文件)
```

---

## 快速开始

### 环境要求

- **Node.js** ≥ 20
- **npm** ≥ 9

### 1. 克隆项目

```bash
git clone https://github.com/your-username/LKB-hot-monitor.git
cd LKB-hot-monitor
```

### 2. 配置环境变量

```bash
cp server/.env.example server/.env
```

编辑 `server/.env`，填入你的 API Key：

```env
# 必填 — AI 分析
OPENROUTER_API_KEY=your_openrouter_api_key

# 可选 — Twitter 数据源
TWITTER_API_KEY=your_twitter_api_key

# 可选 — 邮件通知
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_password
NOTIFY_EMAIL=receive_notifications@email.com
```

> **获取 OpenRouter API Key：** 访问 [openrouter.ai](https://openrouter.ai/) 注册并创建 Key

### 3. 安装依赖

```bash
# 后端
cd server && npm install

# 前端
cd ../client && npm install
```

### 4. 启动开发环境

```bash
# 启动后端 (端口 3000)
cd server && npm start

# 启动前端 (端口 5173)
cd client && npm run dev
```

访问 http://localhost:5173 即可使用。

### 5. 生产部署

```bash
# 构建前端
cd client && npm run build

# 后端会自动 serve client/dist 静态文件
cd ../server && npm start
```

访问 http://localhost:3000 即可。

---

## API 接口

### 关键词管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/keywords` | 获取所有关键词 |
| `POST` | `/api/keywords` | 添加关键词 |
| `PUT` | `/api/keywords/:id` | 更新关键词 |
| `DELETE` | `/api/keywords/:id` | 删除关键词 |
| `PUT` | `/api/keywords/:id/toggle` | 启停关键词 |

### 热点查询

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/hotspots` | 获取热点列表 (分页 + 7维筛选) |
| `GET` | `/api/hotspots/:id` | 获取热点详情 |
| `POST` | `/api/hotspots/refresh` | 手动触发扫描 |
| `GET` | `/api/hotspots/stats/overview` | 统计概览 |

### 通知管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/notifications` | 获取通知列表 |
| `PUT` | `/api/notifications/:id/read` | 标记已读 |
| `PUT` | `/api/notifications/read-all` | 全部已读 |
| `DELETE` | `/api/notifications/all` | 清空通知 |

### WebSocket 事件

| 事件 | 方向 | 说明 |
|------|------|------|
| `new-hotspot` | Server → Client | 新热点推送 |
| `scan-progress` | Server → Client | 扫描状态 (started/pushing/done/idle) |

---

## 数据库设计

```sql
-- 关键词
keywords (id, keyword, type, enabled, created_at, updated_at)

-- 热点
hotspots (id, title, summary, source, source_url, keyword_id,
          heat_score, is_verified, ai_analysis, raw_data,
          published_at, created_at)

-- 通知
notifications (id, hotspot_id, type, status, sent_at, created_at)

-- 设置
settings (key, value, updated_at)

-- 扫描日志
scan_logs (id, keyword, source_counts, total_found, verified_count,
           duration_ms, created_at)
```

---

## Agent Skill 使用

### 安装

将 `skills/hot-monitor/` 目录复制到你的 Agent skill 目录即可：

- **Claude Code:** `~/.claude/skills/hot-monitor/`
- **VS Code Copilot:** `~/.agents/skills/hot-monitor/`

### 使用示例

```
> 帮我监控 GPT-5
> 最近 AI 编程有什么热点？
> 查一下 Cursor 的最新动态
> 扫描全部关键词
```

Skill 会自动通过网页搜索和 RSS 采集信息，利用 Agent 自身 AI 能力分析过滤，直接在对话中返回结果。

---

## 部署方式

### 方式 1：内网穿透 (Cloudflare Tunnel)

适合个人使用，本机运行 + 公网访问：

```bash
# 安装 cloudflared
winget install Cloudflare.cloudflared    # Windows
brew install cloudflared                  # macOS

# 一键启动隧道
cloudflared tunnel --url http://localhost:3000
```

### 方式 2：注册为系统服务

使用 NSSM 注册 Windows 服务，关闭编辑器/终端后仍然运行：

```powershell
nssm install HotMonitorBackend "C:\Program Files\nodejs\node.exe" "D:\LKB-hot-monitor\server\index.js"
nssm set HotMonitorBackend AppDirectory "D:\LKB-hot-monitor\server"
nssm set HotMonitorBackend Start SERVICE_AUTO_START
nssm start HotMonitorBackend
```

### 方式 3：云服务器部署

```bash
# 使用 PM2 守护进程
npm install -g pm2
cd server && pm2 start index.js --name hot-monitor

# Nginx 反向代理（支持 WebSocket）
```

---

## 版本历史

| 版本 | 日期 | 主要更新 |
|------|------|---------|
| **V3.0** | 2026-03-23 | AI 审核精准化：查询扩展、Prompt 重写、源级质量门槛、推送状态指示器 |
| **V2.1** | 2026-03-23 | 排序修复、排名标记、热度标签、通知内容展示 |
| **V2.0** | 2026-03-23 | 多源扩展 (B站/微博/Web6源)、扫描超时保护、每日自动清理 |
| **V1.1** | 2026-03-22 | 深色→浅色春绿主题全面改版 |
| **V1.0** | 2026-03-22 | 初始版本：React + Express + SQLite + 多源采集 + AI 分析 |

详见 [CHANGELOG.md](CHANGELOG.md)

---

## 开源协议

MIT License

---

## 作者

**李柯兵** — AI 领域博主 & 开发者

如有问题或建议，欢迎提 Issue。
