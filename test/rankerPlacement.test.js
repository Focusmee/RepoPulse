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

test("ranker routes hot but weak profile matches to observation instead of deep read", () => {
  const profile = {
    preferred_languages: ["TypeScript"],
    interested_topics: ["agent"],
    learning_goals: ["做应用"],
    excluded_topics: []
  };
  const repo = makeRepo(1, "demo/hot-rust-platform", "Rust platform with fast growth");
  repo.language = "Rust";
  repo.topics = ["rust", "platform"];
  const analysis = {
    ...makeAnalysis(),
    profile_fit: { score: 35, why_for_this_user: "Trend is interesting but profile match is weak" }
  };

  const ranked = rankAnalyzedRepos({
    repos: [repo],
    analyses: new Map([["1", analysis]]),
    trends: new Map([["1", { trend_score: 95, stars_1d: 900, source_tags: ["github_trending:daily"] }]]),
    profile,
    documents: new Map([["1", { readme_status: "ok", readme_text: "README".repeat(100) }]]),
    referenceDate: "2026-05-18",
    limit: 1
  });

  assert.equal(ranked.items[0].category, "上升很快，值得观察");
  assert.equal(ranked.items[0].recommendation_level, "值得观察");
});

test("ranker blocks strong recommendation when high risk is present", () => {
  const profile = {
    preferred_languages: ["TypeScript"],
    interested_topics: ["agent"],
    learning_goals: ["做应用"],
    excluded_topics: []
  };
  const repo = makeRepo(1, "demo/risky-agent-platform");
  const analysis = {
    ...makeAnalysis(),
    risks: [{ risk: "仓库已归档，后续维护和安全修复不可期待。", severity: "high" }]
  };

  const ranked = rankAnalyzedRepos({
    repos: [repo],
    analyses: new Map([["1", analysis]]),
    trends: new Map([["1", { trend_score: 90, stars_1d: 700, source_tags: ["github_trending:daily"] }]]),
    profile,
    documents: new Map([["1", { readme_status: "ok", readme_text: "README".repeat(100) }]]),
    referenceDate: "2026-05-18",
    limit: 1
  });

  assert.equal(ranked.items[0].category, "谨慎关注");
  assert.notEqual(ranked.items[0].recommendation_level, "强推荐");
});

test("ranker changes placement for different skill level and time budget profiles", () => {
  const complexRepo = makeRepo(1, "demo/kubernetes-agent-platform", "Kubernetes orchestration platform for distributed agents");
  complexRepo.language = "Rust";
  complexRepo.topics = ["kubernetes", "agent", "platform"];
  complexRepo.open_issues = 420;
  const simpleRepo = makeRepo(2, "demo/typescript-agent-cli", "TypeScript agent CLI with quickstart examples");
  simpleRepo.topics = ["agent", "developer-tools"];

  const analyses = new Map([
    ["1", { ...makeAnalysis(), profile_fit: null, project_idea: "Extract a Kubernetes agent architecture demo" }],
    [
      "2",
      {
        ...makeAnalysis(),
        summary: "TypeScript agent CLI",
        problem_solved: "Runs agent CLI demos",
        profile_fit: null,
        learning_value: { ...makeAnalysis().learning_value, score: 90 },
        project_idea: "Ship a small TypeScript CLI demo"
      }
    ]
  ]);
  const trends = new Map([
    ["1", { trend_score: 95, stars_1d: 900, source_tags: ["github_trending:daily"] }],
    ["2", { trend_score: 45, stars_1d: 20, source_tags: ["search:topic:agent"] }]
  ]);
  const documents = new Map([
    ["1", { readme_status: "ok", readme_text: "Requires Kubernetes GPU workers OAuth and distributed platform setup." }],
    ["2", { readme_status: "ok", readme_text: "## Quickstart\n\nRun npm install and npm run demo. TypeScript CLI examples.".repeat(20) }]
  ]);
  const junior = {
    preferred_languages: ["TypeScript"],
    interested_topics: ["agent"],
    learning_goals: ["做应用"],
    excluded_topics: [],
    skill_level: "junior",
    known_stack: ["TypeScript"],
    weak_areas: ["Kubernetes", "Rust"],
    time_budget: "quick-scan",
    preferred_project_size: "small",
    goal_priority: ["ship_demo"]
  };
  const senior = {
    preferred_languages: ["Rust", "TypeScript"],
    interested_topics: ["agent", "kubernetes"],
    learning_goals: ["学习工程架构"],
    excluded_topics: [],
    skill_level: "senior",
    known_stack: ["Rust", "Kubernetes", "Docker"],
    weak_areas: [],
    time_budget: "deep-study",
    preferred_project_size: "large",
    goal_priority: ["learn_architecture"]
  };

  const juniorRanked = rankAnalyzedRepos({ repos: [complexRepo, simpleRepo], analyses, trends, profile: junior, documents, referenceDate: "2026-05-18", limit: 2 });
  const seniorRanked = rankAnalyzedRepos({ repos: [complexRepo, simpleRepo], analyses, trends, profile: senior, documents, referenceDate: "2026-05-18", limit: 2 });

  assert.equal(juniorRanked.items[0].repo.full_name, "demo/typescript-agent-cli");
  assert.equal(seniorRanked.items[0].repo.full_name, "demo/kubernetes-agent-platform");
  assert.equal(juniorRanked.items.find((item) => item.repo.repo_id === 1).analysis.learning_cost.level, "high");
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
