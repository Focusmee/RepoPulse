import test from "node:test";
import assert from "node:assert/strict";
import { validateAnalysis } from "../src/ai/schema.js";

test("schema validation rejects empty evidence and invalid risk severity", () => {
  const validation = validateAnalysis({
    summary: "demo",
    learning_value: {
      score: 50,
      level: "medium",
      breakdown: [{ id: "documentation_quality", score: 50, reason: "", evidence: "" }],
      reasons: [{ reason: "", evidence: "" }]
    },
    recommended_reading_path: [{ step: 1, action: "", goal: "" }],
    risks: [{ risk: "", severity: "critical" }],
    confidence: { score: 80 }
  });

  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes("evidence")));
  assert.ok(validation.errors.some((error) => error.includes("severity")));
});
