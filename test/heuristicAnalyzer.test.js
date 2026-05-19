import test from "node:test";
import assert from "node:assert/strict";
import { analyzeRepoHeuristically } from "../src/ai/heuristicAnalyzer.js";

test("heuristic analyzer returns explainable learning breakdown", () => {
  const analysis = analyzeRepoHeuristically({
    repo: {
      repo_id: 1,
      full_name: "demo/agent-tool",
      description: "LLM agent workflow developer tool",
      language: "TypeScript",
      topics: ["llm", "agent", "developer-tools"],
      stars: 1200,
      forks: 120,
      license: "MIT",
      pushed_at: "2026-05-15"
    },
    trend: {
      trend_score: 70,
      stars_1d: 10,
      stars_7d: 80,
      forks_7d: 8,
      source_tags: ["github_trending:daily"]
    },
    documents: {
      readme_text: `
# Agent Tool

## Quickstart

Install and run the CLI.

## Usage

Use the SDK to build an agent workflow.

## Architecture

The core engine includes providers, runtime modules, examples and tests.
      `
    },
    profile: {
      role: "AI 应用开发者",
      preferred_languages: ["TypeScript"],
      interested_topics: ["llm", "agent"],
      learning_goals: ["做应用"],
      excluded_topics: []
    }
  });

  assert.equal(analysis.learning_value.breakdown.length, 7);
  assert.ok(analysis.learning_value.breakdown.every((item) => item.reason && item.evidence));
  assert.ok(analysis.learning_value.score > 0);
  assert.equal(["low", "medium", "high"].includes(analysis.learning_cost.level), true);
  assert.ok(analysis.learning_cost.investment_fit_score >= 0);
  assert.ok(analysis.recommended_reading_path.length <= 3);
  assert.ok(analysis.context_explanation.includes("AI 应用开发者"));
  assert.ok(analysis.use_case_example.length > 0);
  assert.ok(analysis.learning_takeaways.length >= 2);
});

test("heuristic analyzer produces specific P2 risk categories", () => {
  const analysis = analyzeRepoHeuristically({
    repo: {
      repo_id: 2,
      full_name: "demo/experimental-cloud-agent",
      description: "Experimental agent platform with OpenAI API key and OAuth integrations",
      language: "Python",
      topics: ["agent", "platform", "oauth"],
      stars: 800,
      forks: 50,
      license: "",
      open_issues: 450,
      pushed_at: "2026-05-10"
    },
    trend: {
      trend_score: 80,
      stars_1d: 100,
      stars_7d: 700,
      forks_7d: 60,
      source_tags: ["github_trending:daily"]
    },
    documents: {
      readme_text: "# Demo\n\nExperimental platform that requires an OpenAI API key, OAuth login and external cloud services."
    },
    profile: {
      role: "AI 应用开发者",
      preferred_languages: ["TypeScript"],
      interested_topics: ["agent"],
      learning_goals: ["做应用"],
      excluded_topics: []
    },
    referenceDate: "2026-05-18"
  });

  const riskText = analysis.risks.map((risk) => risk.risk).join("\n");
  assert.match(riskText, /license|API|OAuth|外部服务|平台/);
  assert.ok(analysis.risks.every((risk) => risk.risk.length >= 10));
});
