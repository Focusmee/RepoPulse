import test from "node:test";
import assert from "node:assert/strict";
import { preselectRepos } from "../src/rankers/preselector.js";

test("preselector considers rough profile fit before deep analysis", () => {
  const profile = {
    preferred_languages: ["TypeScript"],
    interested_topics: ["llm", "agent"],
    learning_goals: ["做应用"],
    excluded_topics: []
  };
  const repos = [
    {
      repo_id: 1,
      full_name: "demo/hot",
      description: "",
      language: "Go",
      topics: [],
      source_tags: ["github_trending:daily"]
    },
    {
      repo_id: 2,
      full_name: "demo/profile-fit",
      description: "llm agent app tool",
      language: "TypeScript",
      topics: ["llm", "agent"],
      source_tags: ["search:topic:llm"]
    }
  ];
  const trends = new Map([
    ["1", { trend_score: 70 }],
    ["2", { trend_score: 40 }]
  ]);

  const selected = preselectRepos({ repos, trends, profile, limit: 1 });

  assert.equal(selected[0].repo_id, 2);
});
