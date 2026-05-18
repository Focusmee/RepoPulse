import test from "node:test";
import assert from "node:assert/strict";
import { rankAnalyzedRepos } from "../src/rankers/personalizedRanker.js";

test("ranker limits strong recommendations and routes resource collections to ideas", () => {
  const profile = {
    preferred_languages: ["TypeScript"],
    interested_topics: ["agent"],
    learning_goals: ["做应用"],
    excluded_topics: []
  };
  const repos = [
    makeRepo(1, "demo/awesome-agent-apps", "Curated list of agent resources"),
    makeRepo(2, "demo/agent-platform"),
    makeRepo(3, "demo/agent-workflow"),
    makeRepo(4, "demo/agent-runtime"),
    makeRepo(5, "demo/agent-memory"),
    makeRepo(6, "demo/agent-cli")
  ];
  const analyses = new Map(repos.map((repo) => [String(repo.repo_id), makeAnalysis()]));
  const trends = new Map(repos.map((repo) => [String(repo.repo_id), { trend_score: 70, source_tags: ["github_trending:daily"] }]));
  const documents = new Map(repos.map((repo) => [String(repo.repo_id), { readme_status: "ok", readme_text: "README".repeat(100) }]));

  const ranked = rankAnalyzedRepos({ repos, analyses, trends, profile, documents, referenceDate: "2026-05-18", limit: 6 });

  assert.ok(ranked.items.filter((item) => item.recommendation_level === "强推荐").length <= 3);
  assert.ok(ranked.items.filter((item) => item.category === "今日最值得深读").length <= 3);
  assert.equal(ranked.items.find((item) => item.repo.full_name === "demo/awesome-agent-apps").category, "可转化为项目灵感");
});

test("ranker does not route every project idea to project inspiration", () => {
  const profile = {
    preferred_languages: ["TypeScript"],
    interested_topics: ["agent"],
    learning_goals: ["做应用"],
    excluded_topics: []
  };
  const repos = [
    makeRepo(1, "demo/agent-platform"),
    makeRepo(2, "demo/ordinary-library", "Agent helper library")
  ];
  const analyses = new Map([
    ["1", makeAnalysis()],
    [
      "2",
      {
        ...makeAnalysis(),
        learning_value: {
          ...makeAnalysis().learning_value,
          score: 62,
          breakdown: [
            { id: "documentation_quality", label: "文档清晰度", weight: 0.2, score: 70, reason: "Usable docs", evidence: "README usage section includes commands" },
            { id: "practical_transfer_value", label: "实战迁移价值", weight: 0.15, score: 60, reason: "Limited transfer", evidence: "README describes one narrow helper API" }
          ]
        },
        profile_fit: { score: 65, why_for_this_user: "Some agent overlap" },
        project_idea: "Wrap it into a small portfolio project"
      }
    ]
  ]);
  const trends = new Map([
    ["1", { trend_score: 20, source_tags: ["search:topic:agent"] }],
    ["2", { trend_score: 20, source_tags: ["search:topic:agent"] }]
  ]);
  const documents = new Map(repos.map((repo) => [String(repo.repo_id), { readme_status: "ok", readme_text: "README".repeat(100) }]));

  const ranked = rankAnalyzedRepos({ repos, analyses, trends, profile, documents, referenceDate: "2026-05-18", limit: 2 });

  assert.notEqual(ranked.items.find((item) => item.repo.full_name === "demo/ordinary-library").category, "可转化为项目灵感");
});

function makeRepo(repo_id, full_name, description = "Agent platform for TypeScript developers") {
  return {
    repo_id,
    full_name,
    name: full_name.split("/")[1],
    description,
    language: "TypeScript",
    topics: ["agent", "llm"],
    license: "MIT",
    stars: 1000,
    forks: 100,
    open_issues: 5,
    pushed_at: "2026-05-01",
    html_url: `https://github.com/${full_name}`
  };
}

function makeAnalysis() {
  return {
    summary: "Agent platform",
    problem_solved: "Builds agent apps",
    learning_value: {
      score: 90,
      level: "high",
      breakdown: [
        { id: "documentation_quality", label: "文档清晰度", weight: 0.2, score: 90, reason: "Quick start is clear", evidence: "README Quick Start includes runnable commands" },
        { id: "code_structure_readability", label: "工程结构可读性", weight: 0.2, score: 85, reason: "Modules are clear", evidence: "README describes packages and examples" }
      ],
      reasons: [
        { reason: "Clear quick start", evidence: "README Quick Start includes runnable commands" },
        { reason: "Good transfer value", evidence: "MIT license and TypeScript package structure" }
      ]
    },
    profile_fit: { score: 95, why_for_this_user: "Matches TypeScript and agent goals" },
    recommended_reading_path: [{ step: 1, action: "Read README", goal: "Understand setup" }],
    project_idea: "Build a small agent app",
    risks: [{ risk: "API may change", severity: "low" }],
    confidence: { score: 90, reason: "README evidence is concrete" }
  };
}
