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
  assert.ok(validation.errors.some((error) => error.includes("learning_cost")));
});

test("schema validation accepts normalized learning cost", () => {
  const validation = validateAnalysis({
    summary: "demo",
    learning_value: {
      score: 80,
      level: "high",
      breakdown: [
        { id: "documentation_quality", score: 80, reason: "clear", evidence: "README Quickstart includes commands" },
        { id: "code_structure_readability", score: 80, reason: "clear", evidence: "README describes packages" },
        { id: "technical_representativeness", score: 80, reason: "trend", evidence: "topics include agent" },
        { id: "practical_transfer_value", score: 80, reason: "demo", evidence: "examples are runnable" },
        { id: "maturity_signal", score: 80, reason: "active", evidence: "recent pushed_at metadata" },
        { id: "profile_goal_fit", score: 80, reason: "fit", evidence: "language matches profile" },
        { id: "overall_judgement", score: 80, reason: "balanced", evidence: "combined README and metadata" }
      ],
      reasons: [{ reason: "Good docs", evidence: "README Quickstart includes commands" }]
    },
    learning_cost: {
      level: "low",
      investment_fit_score: 82,
      estimated_effort: "半天跑通",
      prerequisites: [],
      blockers: [],
      why_for_this_user: "技术栈匹配"
    },
    recommended_reading_path: [{ step: 1, action: "Read README", goal: "Understand setup" }],
    risks: [{ risk: "需要复核 release 节奏。", severity: "low" }],
    confidence: { score: 80 }
  });

  assert.equal(validation.ok, true);
});
