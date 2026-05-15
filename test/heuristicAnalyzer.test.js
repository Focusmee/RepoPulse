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
});
