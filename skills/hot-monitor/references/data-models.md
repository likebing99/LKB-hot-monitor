# 数据模型定义

本文档定义了 `.hot-monitor/` 目录下所有数据文件的 JSON Schema。读写数据文件时参考本文件。

---

## 目录结构

```
.hot-monitor/
├── keywords.json       # 关键词列表
├── config.json         # 可选配置（API Key 等）
└── results/
    ├── 2026-03-24.json # 按日期存储的扫描结果
    ├── 2026-03-23.json
    └── ...
```

首次使用时，如果 `.hot-monitor/` 目录不存在，按以下顺序创建：
1. 创建 `.hot-monitor/` 目录
2. 创建 `keywords.json`，内容为 `{"keywords": []}`
3. 创建 `results/` 目录

---

## keywords.json

```json
{
  "keywords": [
    {
      "keyword": "GPT-5",
      "type": "keyword",
      "enabled": true,
      "created_at": "2026-03-24T10:00:00Z"
    },
    {
      "keyword": "AI编程",
      "type": "domain",
      "enabled": true,
      "created_at": "2026-03-24T10:01:00Z"
    }
  ]
}
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| keyword | string | 是 | 关键词文本 |
| type | string | 是 | 类型：`keyword`（通用关键词）、`domain`（领域）、`person`（人物）、`product`（产品） |
| enabled | boolean | 是 | 是否启用，默认 true |
| created_at | string (ISO 8601) | 是 | 创建时间 |

**操作规则：**
- 添加前按 `keyword` 字段（不区分大小写）去重
- 删除时按 `keyword` 精确匹配
- 启停时翻转 `enabled` 布尔值

---

## config.json（可选）

仅当用户提供了 API Key 时才创建此文件。

```json
{
  "twitter_api_key": "用户提供的twitterapi.io密钥"
}
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| twitter_api_key | string | 否 | twitterapi.io 的 API Key，用于 Twitter 数据源 |

**安全规则：**
- 不要在对话中展示 API Key 明文
- 读取时仅检查是否存在，不输出值

---

## 每日结果文件：results/YYYY-MM-DD.json

```json
{
  "date": "2026-03-24",
  "scans": [
    {
      "scan_time": "2026-03-24T10:30:00Z",
      "keyword": "GPT-5",
      "variants_used": ["GPT5", "GPT-5 发布", "GPT-5 release"],
      "sources_used": ["firecrawl", "google_news_rss", "rss_feeds"],
      "raw_count": 15,
      "filtered_count": 5,
      "results": [
        {
          "title": "OpenAI 正式发布 GPT-5 模型",
          "url": "https://example.com/article/123",
          "source": "web",
          "source_name": "TechCrunch",
          "summary": "OpenAI 今日正式发布 GPT-5，在推理能力和长文本处理方面有显著提升...",
          "heat_score": 9,
          "relevance_type": "direct",
          "keyword_mentioned": true,
          "is_verified": true,
          "confidence": 0.95,
          "published_at": "2026-03-24T08:00:00Z"
        }
      ]
    }
  ]
}
```

**顶层字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| date | string (YYYY-MM-DD) | 日期 |
| scans | array | 当天所有扫描记录 |

**scan 对象字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| scan_time | string (ISO 8601) | 扫描执行时间 |
| keyword | string | 扫描的关键词 |
| variants_used | string[] | 使用的查询变体 |
| sources_used | string[] | 使用的数据源 |
| raw_count | number | 原始搜索结果数 |
| filtered_count | number | 通过过滤的结果数 |
| results | array | 通过过滤的热点列表 |

**result 对象字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| title | string | 标题 |
| url | string | 原文链接 |
| source | string | 来源类型：`web`、`twitter`、`rss`、`bilibili`、`weibo` |
| source_name | string | 来源名称（如 "TechCrunch"、"微博"） |
| summary | string | 中文摘要（≤ 100 字） |
| heat_score | number (1-10) | 热度评分 |
| relevance_type | string | `direct` 或 `indirect` |
| keyword_mentioned | boolean | 关键词/变体是否出现 |
| is_verified | boolean | 真实性是否验证通过 |
| confidence | number (0-1) | 判断置信度 |
| published_at | string (ISO 8601) \| null | 发布时间（如有） |

---

## 数据生命周期

- **每日结果文件**：每天一个文件，文件名即日期
- **自动追加**：同一天内多次扫描，结果追加到同一文件的 `scans` 数组中
- **无自动清理**：旧日期文件保留，用户可手动删除
- **查询历史**：读取 results/ 目录下的文件列表即可获知有哪些天有扫描记录
