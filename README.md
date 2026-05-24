# RepoPulse

RepoPulse 是一个面向 AI 开发者的个性化开源项目雷达与学习决策日报工具。它每天从 GitHub 候选项目中筛出更值得学习、借鉴、复刻或转化为应用机会的项目，并生成可阅读的 Markdown / HTML 日报。

它不是单纯的热榜，而是回答：

> 今天哪些开源项目值得我投入学习时间，为什么，应该怎么学？

## 产品化路线

当前产品化优先采用“网站入口 + SBTI 测试 + 个性化日报 / 雷达订阅”，不先做完整 SaaS。网站负责介绍产品、展示样例、承接 SBTI 测试和订阅转化；GitHub 采集、分析、排序和日报生成仍由 RepoPulse 主流程完成。

完整路线、变现层级和 SaaS 化触发条件见 `docs/11-产品化与变现路线.md`。

## 功能

- GitHub Trending 采集。
- GitHub Repository Search 采集。
- 自定义 watchlist。
- 本地 JSON 存储仓库、快照、文档、分析结果和日报。
- 热度分 `trend_score`。
- 学习价值分 `learning_score`。
- 用户画像个性化排序。
- README / Release 上下文补充。
- 可选 OpenAI 分析；未配置时自动使用本地规则分析。
- Markdown 日报输出。

## 快速开始

```bash
npm run doctor
npm run report
```

默认报告会生成到：

```text
reports/YYYY/YYYY-MM-DD-default.md
```

本地数据会保存到：

```text
data/repopulse.store.json
```

## 推荐配置

复制 `.env.example` 为 `.env`，按需设置环境变量。项目内置了轻量 `.env` 读取，不需要额外安装 dotenv。

如果你想临时设置，也可以在 PowerShell 中这样运行：

```powershell
$env:GITHUB_TOKEN="你的 GitHub Token"
$env:OPENAI_API_KEY="你的 OpenAI Key"
$env:OPENAI_MODEL="你的模型名"
$env:OPENAI_TIMEOUT_MS="60000"
npm run report
```

`GITHUB_TOKEN` 推荐设置，否则 GitHub API 限流较低。

`OPENAI_API_KEY` 和 `OPENAI_MODEL` 都设置时，RepoPulse 会尝试 AI 分析；没有设置或调用失败时，会自动降级为本地规则分析。

调试模型坏 JSON 或 OpenAI-compatible provider 时可以临时打开：

```powershell
$env:REPOPULSE_DEBUG_AI="1"
$env:REPOPULSE_DEBUG_DIR="data/debug-ai"
npm run report -- --profile config/profiles/ai-builder.json --max-candidates 20 --max-analyze 3 --limit 3
```

失败上下文会写入 `data/debug-ai`，日报也会显示 AI 成功数、heuristic 降级数和失败类型分布。

更完整的配置、prompt 优化、评分明细和人工评测流程见：

```text
docs/10-配置与推荐可信度提升指南.md
```

## 常用命令

```bash
npm run doctor
npm run profiles
npm run report -- --profile config/profiles/ai-builder.json --limit 8
npm run brief -- --input reports/2026/2026-05-19-ai-builder.md --output outputs/brief/2026-05-19-ai-builder.html
npm run report -- --no-ai --max-candidates 40 --max-analyze 12
```

## 用户画像

画像文件放在 `config/profiles/`。示例：

```json
{
  "profile_id": "ai-builder",
  "role": "AI 应用开发者",
  "preferred_languages": ["TypeScript", "Python"],
  "interested_topics": ["llm", "agent", "rag", "developer-tools"],
  "learning_goals": ["做应用", "发现可做成应用的项目", "跟趋势"],
  "excluded_topics": ["blockchain"],
  "daily_limit": 10
}
```

### 画像用途

当前内置画像分为产品变现和多平台推广两类：

| 画像 | 用途 | 推荐场景 |
| --- | --- | --- |
| `ai-builder` | 核心付费画像 | 面向 AI 应用开发者 / 独立开发者的 AI Builder Radar |
| `ai-career-builder` | 求职转型画像 | 小红书、抖音、B 站等内容中展示 AI 简历项目和学习路径 |
| `ai-product-operator` | 产品运营画像 | 面向产品、运营、增长岗位，强调可落地工具和业务效率 |
| `industry-ai-explorer` | 泛行业获客画像 | 面向想用 AI 改造业务的人，强调行业应用机会和外包/合作方向 |
| `default` | 通用开发者画像 | 本地默认运行和回归验证 |
| `java-backend` | Java 后端画像 | Java / 分布式 / 后端求职与架构学习 |

### SBTI 画像生成

SBTI AI 开发者画像生成模块可以把测试答案转换成兼容 RepoPulse 的 profile JSON：

```bash
npm run sbti -- --sample
npm run sbti -- --interactive --output config/profiles/sbti-generated.json
npm run sbti -- --input examples/sbti-answer.sample.json --output config/profiles/sbti-generated.json
npm run report -- --profile config/profiles/sbti-generated.json --limit 8
```

`config/profiles/sbti-generated.json` 是脚本生成的示例 profile，可重复覆盖；模块说明见 `src/persona/README.md`。

## Watchlist

`config/watchlist.json` 用于补充你长期关注的 topic、keyword 或指定仓库。

```json
{
  "topics": ["agent", "rag", "developer-tools"],
  "keywords": ["workflow engine", "code agent"],
  "repos": ["owner/name"]
}
```

## 精华版 HTML

用于试读、推广和私信成交时，可以把完整 Markdown 日报压缩成 5 分钟可读的 HTML 精华版：

```bash
npm run brief -- --input reports/2026/2026-05-19-ai-builder.md --output outputs/brief/2026-05-19-ai-builder.html
```

精华版只保留 Top 3 深读项目和最多 2 个项目灵感，突出“是否值得点开、为什么值得看、最大风险、推荐动作”。HTML 内置打印样式，可先通过浏览器打印为 PDF；首版不引入自动 PDF 依赖。

## 项目结构

```text
src/
  ai/          AI 与本地规则分析
  collectors/ GitHub Trending/Search/watchlist 采集
  config/     画像、watchlist、环境配置
  documents/  README / Release 抓取
  jobs/       dailyDigest 主流水线
  persona/    SBTI AI 开发者画像生成
  rankers/    个性化排序
  reports/    Markdown 渲染
  scorers/    热度分、画像匹配
  store/      本地 JSON 存储
  shared/     通用工具
```

## 开发约束

长期开发请先阅读 `docs/README.md`。特别是：

- 改评分前看 `docs/03-评分模型规范.md`。
- 改数据源前看 `docs/04-数据源与数据治理规范.md`。
- 改 AI prompt 前看 `docs/05-AI分析与提示词契约.md`。
- 发布前按 `docs/08-验收标准与测试计划.md` 验收。

## 测试

```bash
npm test
```

## 人工评测

20 个项目的人工评测样本在：

```text
config/evaluation/manual-review-20.json
```

它用于校准摘要准确性、推荐理由、学习价值分、阅读路径和风险提示。
