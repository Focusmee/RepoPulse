import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const SCRIPT = "scripts/generate-sbti-showcase.js";

test("SBTI showcase script writes three reusable sample outputs", () => {
  const outputDir = mkdtempSync(join(tmpdir(), "repopulse-sbti-showcase-"));
  const result = spawnSync(process.execPath, [SCRIPT, "--output", outputDir], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /SBTI v1 showcase 已生成/);

  const manifestPath = join(outputDir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.cases.length, 3);
  assert.deepEqual(
    manifest.cases.map((item) => item.persona_code),
    ["SBTI", "SMPC", "RBPC"]
  );

  for (const item of manifest.cases) {
    const caseDir = join(outputDir, item.id);
    const profilePath = join(caseDir, "profile.json");
    const profile = JSON.parse(readFileSync(profilePath, "utf8"));
    assert.ok(existsSync(profilePath));
    assert.ok(existsSync(join(caseDir, "persona-result.json")));
    assert.ok(existsSync(join(caseDir, "persona-result.html")));
    assert.equal(profile.generated_by, "scripts/generate-sbti-showcase.js");
    assert.match(item.report_command, new RegExp(`${item.id}/profile\\.json --limit 8 --dry-run`));
  }
});
