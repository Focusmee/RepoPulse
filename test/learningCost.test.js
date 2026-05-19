import test from "node:test";
import assert from "node:assert/strict";
import { estimateLearningCost, normalizeLearningCost } from "../src/scorers/learningCost.js";

test("learning cost is stricter for junior quick-scan profiles on complex projects", () => {
  const repo = {
    full_name: "demo/kubernetes-agent-platform",
    description: "Kubernetes orchestration platform for distributed agents",
    language: "Rust",
    topics: ["kubernetes", "agent", "platform"],
    open_issues: 420
  };
  const analysis = {
    learning_value: { score: 90 },
    risks: [{ risk: "外部服务和 token 配置会影响本地复现。", severity: "medium" }]
  };
  const documents = { readme_text: "# Demo\n\nRequires Kubernetes, GPU workers and custom OAuth setup." };

  const junior = estimateLearningCost({
    repo,
    analysis,
    documents,
    profile: {
      skill_level: "junior",
      preferred_languages: ["TypeScript"],
      known_stack: ["TypeScript"],
      weak_areas: ["Kubernetes", "Rust"],
      time_budget: "quick-scan",
      preferred_project_size: "small",
      goal_priority: ["ship_demo"]
    },
    repoClass: { type: "framework_or_platform" }
  });
  const senior = estimateLearningCost({
    repo,
    analysis,
    documents: { readme_text: "# Demo\n\n## Quickstart\n\nRun the Kubernetes examples." },
    profile: {
      skill_level: "senior",
      preferred_languages: ["Rust"],
      known_stack: ["Rust", "Kubernetes", "Docker"],
      weak_areas: [],
      time_budget: "deep-study",
      preferred_project_size: "large",
      goal_priority: ["learn_architecture"]
    },
    repoClass: { type: "framework_or_platform" }
  });

  assert.equal(junior.level, "high");
  assert.ok(junior.investment_fit_score < senior.investment_fit_score);
  assert.ok(junior.blockers.length > 0);
});

test("learning cost normalization accepts legacy score but emits investment fit score", () => {
  const normalized = normalizeLearningCost({
    level: "low",
    score: 88,
    estimated_effort: "半天跑通",
    prerequisites: "Docker",
    blockers: ["无"],
    why_for_this_user: "已有相关技术栈"
  });

  assert.equal(normalized.investment_fit_score, 88);
  assert.equal(normalized.score, undefined);
  assert.deepEqual(normalized.prerequisites, ["Docker"]);
});
