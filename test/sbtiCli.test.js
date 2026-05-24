import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const SCRIPT = "scripts/generate-sbti-profile.js";

test("SBTI CLI supports interactive answers from stdin", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--interactive", "--print-result-json"], {
    cwd: process.cwd(),
    input: "b\nb\na\na\n1\n2\n3\n4\n",
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /你是：RMTI \/ 趋势观察员型/);
  assert.match(result.stdout, /personaResult JSON/);
});

test("SBTI CLI retries invalid interactive input and writes persona HTML", () => {
  const dir = mkdtempSync(join(tmpdir(), "repopulse-sbti-"));
  const outputPath = join(dir, "profile.json");
  const resultPath = join(dir, "persona.html");
  const result = spawnSync(process.execPath, [SCRIPT, "--interactive", "--output", outputPath, "--result-output", resultPath], {
    cwd: process.cwd(),
    input: "z\n1\n1\n1\n1\n1\n1\n1\n1\n",
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /无效选项/);
  assert.match(readFileSync(outputPath, "utf8"), /"persona_code": "SBTI"/);
  assert.match(readFileSync(resultPath, "utf8"), /<!doctype html>/);
  assert.match(readFileSync(resultPath, "utf8"), /你是 SBTI \/ 火速开搞型/);
});
