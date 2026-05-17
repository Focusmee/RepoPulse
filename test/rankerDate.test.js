import test from "node:test";
import assert from "node:assert/strict";
import { calculatePenalty } from "../src/rankers/personalizedRanker.js";

test("maintenance penalty uses the report reference date", () => {
  const repo = {
    license: "MIT",
    archived: false,
    pushed_at: "2025-08-01"
  };
  const analysis = {
    confidence: { score: 90 },
    risks: [{ risk: "ok", severity: "low" }]
  };

  assert.equal(calculatePenalty(repo, analysis, "2026-01-01"), 0);
  assert.equal(calculatePenalty(repo, analysis, "2026-03-01"), 10);
});
