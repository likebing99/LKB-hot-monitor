# 数据源搜索策略

本文档定义了各数据源的具体搜索方式、URL 模板和质量门槛。执行热点搜索时读取本文件。

---

## 1. Firecrawl Search（首选）

如果 `firecrawl_search` 工具可用，优先使用它——最简单且最可靠。

**用法：**
- 调用 `firecrawl_search`，query 设为关键词，limit 设为 10
- 返回结果包含 url、title、description/extract

**示例：**
```
firecrawl_search(query="GPT-5 发布", limit=10)
```

如 Firecrawl 不可用，按下方各源逐一使用 `fetch_webpage` 抓取。

---

## 2. Bing 新闻搜索

**URL 模板：**
```
https://cn.bing.com/news/search?q=${encodeURIComponent(keyword + ' AI')}&FORM=HDRSC6
```

**抓取方式：** `fetch_webpage` 获取 HTML 后提取新闻标题、链接和摘要。

**提取要点：**
- 新闻结果在 `.news-card`、`.newsitem`、`.caption` 容器中
- 备选选择器：`li.b_algo`、`.b_algo`、`.card-with-cluster`
- 提取每条结果的标题文本、链接 href、描述/摘要文本

**质量门槛：**
- 标题长度 ≥ 10 字符，否则丢弃

---

## 3. Google News RSS

**URL 模板：**
```
https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans
```

**抓取方式：** `fetch_webpage` 获取 XML，解析 `<item>` 标签。

**提取要点：**
- 每个 `<item>` 包含：`<title>`、`<link>`、`<pubDate>`、`<source>`
- pubDate 为 RFC 2822 格式

**质量门槛：**
- 标题长度 ≥ 10 字符

---

## 4. DuckDuckGo

**URL 模板：**
```
https://html.duckduckgo.com/html/?q=${encodeURIComponent(keyword + ' AI news')}
```

**抓取方式：** `fetch_webpage` 获取 HTML 后解析。

**提取要点：**
- 结果在 `div.result` 或 `.web-result` 容器中
- 标题在 `a.result__a` 中
- 摘要在 `.result__snippet` 中
- 链接可能含 `uddg` 重定向参数，需解码提取真实 URL

**质量门槛：**
- 标题长度 ≥ 10 字符

---

## 5. Brave News 搜索

**URL 模板：**
```
https://search.brave.com/news?q=${encodeURIComponent(keyword + ' AI')}&source=web
```

**抓取方式：** `fetch_webpage` 获取 HTML 后解析。

**提取要点：**
- 结果在 `div.snippet` 或 `article.story` 中
- 标题在 `a.result-header` 或 `.title` 中
- 摘要在 `.snippet-description` 或 `.description` 中

**质量门槛：**
- 标题长度 ≥ 10 字符（主选择器）
- 标题长度 ≥ 15 字符（备选 `<a>` 标签）

---

## 6. 公开 RSS 源

以下 RSS 源无需任何 Key，可直接用 `fetch_webpage` 抓取 XML：

| 名称 | RSS URL |
|------|---------|
| TechCrunch AI | `https://techcrunch.com/category/artificial-intelligence/feed/` |
| The Verge AI | `https://www.theverge.com/rss/ai-artificial-intelligence/index.xml` |
| Ars Technica | `https://feeds.arstechnica.com/arstechnica/technology-lab` |
| MIT Tech Review | `https://www.technologyreview.com/feed/` |
| VentureBeat AI | `https://venturebeat.com/category/ai/feed/` |
| Hacker News AI | `https://hnrss.org/newest?q=AI+LLM+GPT` |
| OpenAI Blog | `https://openai.com/blog/rss.xml` |
| Hugging Face Blog | `https://huggingface.co/blog/feed.xml` |
| 36Kr | `https://36kr.com/feed` |
| 量子位 | `https://www.qbitai.com/feed` |

**RSS 关键词过滤：**
- 将关键词按空格/连字符/下划线拆分为子词
- 在标题 + 摘要中匹配：完整关键词出现，或所有子词（≥ 2 个）都出现
- 匹配不区分大小写

**质量门槛：**
- 标题长度 ≥ 10 字符

---

## 7. B站（Bilibili）— 公开 API

**视频搜索 URL：**
```
https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(keyword)}&page=1&order=pubdate
```

**UP 主搜索 URL（先找人再找视频）：**
```
https://api.bilibili.com/x/web-interface/search/type?search_type=bili_user&keyword=${encodeURIComponent(keyword)}&page=1
```

**UP 主最新视频 URL：**
```
https://api.bilibili.com/x/space/wbi/arc/search?mid=${mid}&ps=5&pn=1&order=pubdate
```

**质量门槛：**
- UP 主视频：播放量 ≥ 500
- 关键词搜索视频：播放量 ≥ 1000

**提取字段：** title、bvid（构建视频链接 `https://www.bilibili.com/video/${bvid}`）、description、play、comment、author

---

## 8. 微博（Weibo）— 公开移动端 API

**关键词搜索 URL：**
```
https://m.weibo.cn/api/container/getIndex?containerid=${encodeURIComponent('100103type=1&q=' + keyword)}&page_type=searchall
```

**用户搜索 URL：**
```
https://m.weibo.cn/api/container/getIndex?containerid=${encodeURIComponent('100103type=3&q=' + keyword)}&page_type=searchall
```

**需要 User-Agent：**
```
Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1
```

**质量门槛：**
- 文本长度 ≥ 50 字符
- 互动总量（点赞 + 评论 + 转发）≥ 20

---

## 9. Twitter（可选，需要 API Key）

仅当用户提供了 `twitterapi.io` 的 API Key 时才使用。

**搜索端点：**
```
GET https://api.twitterapi.io/twitter/tweet/advanced_search?query=${encodeURIComponent(query)}&queryType=Latest
```

**请求头：**
```
x-api-key: <用户提供的Key>
```

**搜索语法：**
```
${keyword} -filter:replies -filter:quote_tweets
```
排除回复和引用推文，只保留原创内容。

**质量门槛：**
- likes ≥ 50
- retweets ≥ 20
- views ≥ 2000
- 文本长度 ≥ 100 字符
- 以 `@` 开头的纯回复推文丢弃

**返回字段：** text、url、likeCount、retweetCount、replyCount、viewCount、createdAt、author.name、author.username、author.verified

---

## 去重策略

从多个来源收集结果后，按以下规则去重：
1. URL 完全相同 → 保留第一条
2. 标题完全相同 → 保留第一条
3. 标题相似度极高（编辑距离很小或包含关系）→ 合并为一条，优先保留信息更丰富/来源更权威的版本
