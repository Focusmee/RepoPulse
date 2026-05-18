import test from "node:test";
import assert from "node:assert/strict";
import { checkReportQuality } from "../src/reports/qualityCheck.js";

test("report quality check catches suspicious tokens and vague evidence", () => {
  const result = checkReportQuality({
    ranked: {
      items: [
        {
          category: "今日最值得深读",
          recommendation_level: "强推荐",
          repo: { full_name: "demo/repo" },
          analysis: {
            summary: "Useful project",
            learning_value: {
              reasons: [{ reason: "Good docs", evidence: "README" }],
              breakdown: []
            },
            recommended_reading_path: [],
            risks: [{ risk: "Depends on external iii engine", severity: "medium" }]
          }
        }
      ]
    }
  });

  assert.ok(result.warning_count >= 2);
  assert.ok(result.warnings.some((warning) => warning.type === "vague_evidence"));
  assert.ok(result.warnings.some((warning) => warning.type === "suspicious_token"));
});

test("report quality check warns when all items are in one section", () => {
  const items = Array.from({ length: 5 }, (_, index) => ({
    category: "今日最值得深读",
    recommendation_level: index < 4 ? "强推荐" : "值得观察",
    repo: { full_name: `demo/repo-${index}` },
    analysis: {
      learning_value: {
        reasons: [{ reason: "Specific", evidence: "README Quick Start includes npm run demo" }],
        breakdown: []
      },
      risks: []
    }
  }));

  const result = checkReportQuality({ ranked: { items } });

  assert.ok(result.warnings.some((warning) => warning.type === "single_category_report"));
  assert.ok(result.warnings.some((warning) => warning.type === "too_many_strong_recommendations"));
});
