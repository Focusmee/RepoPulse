import test from "node:test";
import assert from "node:assert/strict";
import { renderMarkdownReport } from "../src/reports/renderMarkdown.js";

test("markdown renderer escapes untrusted repo and analysis text", () => {
  const markdown = renderMarkdownReport({
    date: "2026-05-18",
    profile: {
      role: "<script>alert(1)</script>",
      preferred_languages: ["TypeScript"],
      interested_topics: ["llm"]
    },
    ranked: {
      items: [
        {
          category: "今日最值得深读",
          repo: {
            full_name: "owner/<bad>",
            topics: ["llm"],
            html_url: "https://github.com/owner/repo"
          },
          trend: {
            stars_1d: null,
            stars_7d: null,
            forks_7d: null,
            source_tags: []
          },
          scores: {
            personalized_score: 80,
            learning_score: 80,
            trend_score: 20,
            profile_match_score: 80
          },
          analysis: {
            summary: "<img src=x>",
            learning_value: {
              breakdown: [{ label: "docs", score: 80, weight: 0.2 }],
              reasons: [{ reason: "<b>good</b>", evidence: "README" }]
            },
            profile_fit: { why_for_this_user: "<u>fit</u>" },
            recommended_reading_path: [{ step: 1, action: "<read>", goal: "learn" }],
            project_idea: "",
            risks: [{ risk: "<risk>", severity: "low" }]
          }
        }
      ]
    },
    stats: {
      candidate_count: 1,
      analysis_attempted_count: 1,
      analyzed_count: 1,
      recommended_count: 1,
      readme_success_rate: 100,
      analysis_success_rate: 100,
      ai_provider_summary: "heuristic 1"
    }
  });

  assert.ok(markdown.includes("&lt;script&gt;"));
  assert.ok(markdown.includes("&lt;img src=x&gt;"));
  assert.equal(markdown.includes("<script>"), false);
  assert.equal(markdown.includes("<img src=x>"), false);
});
