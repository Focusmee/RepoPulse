# RepoPulse

RepoPulse 是一个“学习价值评分 + GitHub 项目发现 + 个性化日报”的标准化工具。它每天从 GitHub 候选项目中筛出更值得学习、借鉴或转化为应用机会的项目，并生成可阅读的 Markdown 日报。

它不是单纯的热榜，而是回答：

> 今天哪些开源项目值得我投入学习时间，为什么，应该怎么学？

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

## Watchlist

`config/watchlist.json` 用于补充你长期关注的 topic、keyword 或指定仓库。

```json
{
  "topics": ["agent", "rag", "developer-tools"],
  "keywords": ["workflow engine", "code agent"],
  "repos": ["owner/name"]
}
```

## 项目结构

```text
src/
  ai/          AI 与本地规则分析
  collectors/ GitHub Trending/Search/watchlist 采集
  config/     画像、watchlist、环境配置
  documents/  README / Release 抓取
  jobs/       dailyDigest 主流水线
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
