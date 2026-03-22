# 更新日志 (CHANGELOG)

## V1.1 — 春意盎然浅色主题 (2026-03-22)

**相比 V1.0 的变更：**

### 主题全面改版：深色 → 浅色春绿主题

- **背景色**：深色 `#030712` → 浅白色 `#f9fdf9`，清新自然
- **主色调**：青色 `#06b6d4` → 春绿 `#16a34a`（green-600）
- **副色调**：紫色 `#8b5cf6` → 翠绿 `#059669`（emerald-600）
- **文字颜色**：浅色文字（适配深色背景）→ 深色文字（适配浅色背景）
- **组件样式**：glass-card、按钮、输入框、导航栏、分数标签等全部适配浅色背景

### UI 组件更新

- **GridBackground**：点阵从灰色改为浅绿色 `#86efac`，渐变光晕改为 green/emerald 系
- **SpotlightCard 鼠标追踪光影**：保留鼠标跟随光影效果，颜色从青色改为暖金色 `rgba(250, 189, 0, 0.12)`，在浅色背景上更明显且和谐
- **Spotlight SVG**：保留不变

### 导航栏

- 标题改名："AI 热点监控" → "**李柯兵AI热点监控工具**"
- 标题颜色：渐变色 → 纯黑色
- 导航项"热点雷达"改名为"**仪表盘**"
- 所有导航文字（仪表盘/关键词/通知/设置）颜色改为黑色
- 在线/离线状态指示器颜色适配浅色背景

### 各页面颜色适配

- **Dashboard**：标题、正文、图标、边框、统计卡片辉光色全部适配浅色主题
- **Keywords**：关键词列表文字、操作按钮颜色适配
- **Notifications**：通知列表文字、已读/未读状态颜色适配
- **Settings**：设置分组标题、图标背景、辉光色适配

### 修改文件清单

| 文件 | 变更说明 |
|------|---------|
| `client/src/index.css` | 全局主题色、组件样式重写（深色→浅色春绿） |
| `client/src/components/ui/GridBackground.jsx` | 背景网格改为浅绿系 |
| `client/src/components/ui/Spotlight.jsx` | 鼠标追踪光影改为暖金色 |
| `client/src/components/Layout.jsx` | 标题改名+黑色、导航项改名+黑色 |
| `client/src/pages/Dashboard.jsx` | 文字/图标/边框颜色适配浅色背景 |
| `client/src/pages/Keywords.jsx` | 文字/按钮颜色适配浅色背景 |
| `client/src/pages/Notifications.jsx` | 通知列表颜色适配浅色背景 |
| `client/src/pages/Settings.jsx` | 设置页颜色适配浅色背景 |

---

## V1.0 — 初始版本 (2026-03-22)

- React 19 + Vite 8 前端，Aurora 赛博朋克深色主题
- Express + sql.js 后端，WebSocket 实时推送
- 多源数据采集：百度/搜狗/必应/Twitter/RSS
- OpenRouter AI 分析（MiniMax M2.5）：真假甄别 + 热度评分
- 每 30 分钟自动扫描（node-cron），支持手动触发
- Dashboard 搜索/筛选/分页，60 秒轮询兜底
- 扫描日志表记录每次扫描详情
- 关键词管理、通知中心、系统设置
