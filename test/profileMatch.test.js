import test from "node:test";
import assert from "node:assert/strict";
import { calculateProfileMatchScore } from "../src/scorers/profileMatch.js";

test("profile match rewards language and topic overlap", () => {
  const score = calculateProfileMatchScore(
    {
      full_name: "demo/agent-tool",
      description: "LLM agent developer tool",
      language: "TypeScript",
      topics: ["llm", "agent", "developer-tools"]
    },
    {
      preferred_languages: ["TypeScript"],
      interested_topics: ["llm", "agent"],
      learning_goals: ["做应用"],
      excluded_topics: []
    }
  );

  assert.ok(score >= 70);
});

test("profile match applies excluded topic penalty", () => {
  const score = calculateProfileMatchScore(
    {
      full_name: "demo/chain",
      description: "blockchain nft wallet",
      language: "TypeScript",
      topics: ["blockchain", "nft"]
    },
    {
      preferred_languages: ["TypeScript"],
      interested_topics: ["developer-tools"],
      learning_goals: ["做应用"],
      excluded_topics: ["blockchain", "nft"]
    }
  );

  assert.ok(score < 40);
});
