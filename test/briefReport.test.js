import test from "node:test";
import assert from "node:assert/strict";
import { extractBriefFromMarkdown } from "../src/reports/extractBriefFromMarkdown.js";
import { renderBriefHtml } from "../src/reports/renderBriefHtml.js";
import { buildFullReportModel } from "../src/reports/models/buildFullReportModel.js";
import { buildBriefReportModel } from "../src/reports/models/buildBriefReportModel.js";

const sampleMarkdown = `# RepoPulse 日报 - 2026-05-19

画像：AI 应用开发者；偏好语言：TypeScript、Python；关注方向：agent、rag

## 今日结论

今天更值得关注的方向是：agent(3)、rag(2)。推荐优先看能快速做 demo 的项目。

## 运行概览
- 候选项目：80
- 分析成功：20
- 最终推荐：10
- 质量警告：1

## 今日最值得深读

### 1. owner/repo-one
- 一句话定位：Agent demo builder
- 项目背景与使用场景：适合用来学习如何把 agent 工作流封装成可运行 demo。
- 简单例子：例如，把它改成一个自动整理 GitHub 项目的 agent。
- 能学习到什么：
  - 学习 agent workflow 的模块拆分
  - 学习 demo quickstart 的组织方式
- 是否值得点开：建议点开深读：能快速做出 demo。
- 推荐等级：强推荐
- 综合分：91；学习价值：90
- 为什么值得关注：
  - 趋势信号：1 日增星 100
  - 社区信号：stars 1000
- 推荐理由与证据：
  1. 判断：适合复刻；证据：README Quickstart 清晰
  2. 判断：项目小；证据：examples 完整
  3. 判断：第三条不应进入精华；证据：long
- 学习成本：
  - low；投入适配分 90：半天跑通
- 最大风险：
  - medium：依赖外部 API
  - low：release 节奏未知
  - low：第三条不应进入精华
- 推荐动作：
  1. 跑 quickstart，目标：验证 demo
  2. 看 examples，目标：确认复刻路径
- 可转化项目想法：做一个垂直 Agent 模板市场
- 链接：https://github.com/owner/repo-one

### 2. owner/repo-two
- 一句话定位：RAG tool
- 是否值得点开：建议点开深读：适合学习。
- 链接：https://github.com/owner/repo-two

## 可转化为项目灵感

### 1. owner/idea
- 是否值得点开：适合点开找灵感：可做小工具。
- 最大风险：
  - low：文档偏少
- 可转化项目想法：做一个 Chrome 插件
- 链接：https://github.com/owner/idea
`;

test("extracts conclusion, stats and top project fields from markdown", () => {
  const brief = extractBriefFromMarkdown(sampleMarkdown);

  assert.equal(brief.date, "2026-05-19");
  assert.equal(brief.stats["候选项目"], "80");
  assert.equal(brief.topItems.length, 2);
  assert.equal(brief.topItems[0].title, "owner/repo-one");
  assert.equal(brief.topItems[0].link, "https://github.com/owner/repo-one");
  assert.equal(brief.topItems[0].contextExplanation, "适合用来学习如何把 agent 工作流封装成可运行 demo。");
  assert.equal(brief.topItems[0].learningTakeaways.length, 2);
  assert.equal(brief.topItems[0].reasons.length, 2);
  assert.equal(brief.topItems[0].risks.length, 2);
  assert.equal(brief.inspirationItems[0].projectIdea, "做一个 Chrome 插件");
});

test("renders escaped HTML brief and preserves safe GitHub links", () => {
  const brief = extractBriefFromMarkdown(sampleMarkdown);
  brief.topItems.push({
    title: "bad/<script>",
    summary: "<img src=x>",
    clickVerdict: "bad",
    link: "javascript:alert(1)",
    attentionSignals: [],
    reasons: [],
    learningCost: [],
    risks: [],
    actions: []
  });
  const html = renderBriefHtml(brief, { ctaUrl: "https://example.com/subscribe", fullReportUrl: "https://example.com/full" });

  assert.ok(html.includes("https://github.com/owner/repo-one"));
  assert.ok(html.includes("https://example.com/subscribe"));
  assert.ok(html.includes("查看完整版报告"));
  assert.ok(html.includes("class=\"issue-header\""));
  assert.ok(html.includes("class=\"insight-panel\""));
  assert.ok(html.includes("class=\"metric-strip\""));
  assert.ok(html.includes("class=\"decision-grid\""));
  assert.ok(html.includes("class=\"verdict-panel\""));
  assert.ok(html.includes("class=\"idea-panel\""));
  assert.equal(html.includes("<img src=x>"), false);
  assert.equal(html.includes("javascript:alert"), false);
});

test("brief extraction tolerates missing optional fields", () => {
  const brief = extractBriefFromMarkdown(`# RepoPulse 日报 - 2026-05-20

## 今日最值得深读

### 1. owner/minimal
- 链接：https://github.com/owner/minimal
`);
  const html = renderBriefHtml(brief);

  assert.equal(brief.topItems[0].title, "owner/minimal");
  assert.ok(html.includes("owner/minimal"));
});

test("builds brief model from full report model without parsing markdown", () => {
  const full = buildFullReportModel({
    date: "2026-05-19",
    profile: {
      role: "AI 应用开发者",
      preferred_languages: ["TypeScript"],
      interested_topics: ["agent"],
      learning_goals: ["做应用"]
    },
    stats: {
      candidate_count: 10,
      analysis_attempted_count: 2,
      analyzed_count: 2,
      recommended_count: 1,
      readme_success_rate: 100,
      analysis_success_rate: 100,
      ai_provider_summary: "heuristic 1",
      quality_warning_count: 0
    },
    ranked: {
      items: [
        {
          category: "今日最值得深读",
          recommendation_level: "强推荐",
          repo: {
            full_name: "owner/model-driven",
            description: "Agent workflow framework",
            language: "TypeScript",
            topics: ["agent"],
            html_url: "https://github.com/owner/model-driven",
            stars: 100,
            forks: 10,
            open_issues: 1,
            license: "MIT",
            pushed_at: "2026-05-18"
          },
          trend: { stars_1d: 1, stars_7d: 10, forks_7d: 1, source_tags: [] },
          scores: {
            personalized_score: 88,
            learning_score: 90,
            trend_score: 70,
            profile_match_score: 92,
            investment_fit_score: 86
          },
          analysis: {
            summary: "Agent workflow framework",
            problem_solved: "帮助开发者搭建 agent 工作流",
            why_it_matters_now: "适合快速验证 agent demo。",
            learning_value: {
              score: 90,
              level: "high",
              breakdown: [{ id: "documentation_quality", label: "文档清晰度", score: 90, weight: 0.2, reason: "Quickstart 清晰", evidence: "README" }],
              reasons: [{ reason: "适合复刻", evidence: "README Quickstart" }]
            },
            learning_cost: {
              level: "low",
              investment_fit_score: 90,
              estimated_effort: "半天跑通",
              prerequisites: [],
              blockers: [],
              why_for_this_user: "技术栈匹配"
            },
            profile_fit: { why_for_this_user: "匹配 agent 方向" },
            recommended_reading_path: [{ step: 1, action: "跑 quickstart", goal: "验证 demo" }],
            risks: [{ risk: "需要复核 release。", severity: "medium" }],
            confidence: { score: 80, reason: "README 充分" }
          }
        }
      ]
    }
  });
  const brief = buildBriefReportModel(full);
  const html = renderBriefHtml(brief);

  assert.equal(brief.topItems[0].title, "owner/model-driven");
  assert.ok(brief.topItems[0].contextExplanation.includes("帮助开发者搭建 agent 工作流"));
  assert.ok(brief.topItems[0].risks[0].startsWith("中风险"));
  assert.ok(html.includes("项目背景与使用场景"));
});
