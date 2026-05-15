import test from "node:test";
import assert from "node:assert/strict";
import { calculateTrendScores } from "../src/scorers/trendScorer.js";

test("trend scorer uses stored historical snapshots", () => {
  const store = {
    findSnapshotOnOrBefore(repoId, date) {
      if (date === "2026-05-14") return { stars: 90, forks: 10 };
      if (date === "2026-05-08") return { stars: 50, forks: 5 };
      return null;
    }
  };
  const repos = [
    {
      repo_id: 1,
      full_name: "a/hot",
      stars: 100,
      forks: 20,
      open_issues: 5,
      pushed_at: "2026-05-15",
      source_tags: ["github_trending:daily"]
    }
  ];

  const scores = calculateTrendScores(repos, store, "2026-05-15");
  const trend = scores.get("1");

  assert.equal(trend.stars_1d, 10);
  assert.equal(trend.stars_7d, 50);
  assert.equal(trend.forks_7d, 15);
  assert.ok(trend.trend_score > 0);
});
