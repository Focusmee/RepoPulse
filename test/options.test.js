import test from "node:test";
import assert from "node:assert/strict";
import { parseDateOption, parseIntegerOption, parseRunCliOptions } from "../src/config/options.js";

test("date option validates real YYYY-MM-DD dates", () => {
  assert.equal(parseDateOption("2026-05-18", "--date"), "2026-05-18");
  assert.throws(() => parseDateOption("2026-02-30", "--date"), /valid calendar date/);
  assert.throws(() => parseDateOption("20260518", "--date"), /YYYY-MM-DD/);
});

test("integer option rejects missing values, NaN and out of range values", () => {
  assert.equal(parseIntegerOption("12", "--limit", { min: 1, max: 20 }), 12);
  assert.throws(() => parseIntegerOption(true, "--limit"), /requires a numeric value/);
  assert.throws(() => parseIntegerOption("abc", "--limit"), /integer/);
  assert.throws(() => parseIntegerOption("0", "--limit", { min: 1, max: 20 }), /between/);
});

test("run cli options normalizes numeric flags before the job runs", () => {
  const options = parseRunCliOptions({
    date: "2026-05-18",
    limit: "8",
    "max-candidates": "40",
    "max-analyze": "12",
    "no-ai": true
  });

  assert.equal(options.date, "2026-05-18");
  assert.equal(options.limit, 8);
  assert.equal(options.maxCandidates, 40);
  assert.equal(options.maxAnalyze, 12);
  assert.equal(options.noAi, true);
});
