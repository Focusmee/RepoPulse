import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const roots = ["src", "test", "scripts"];
const files = roots.flatMap((root) => collectJavaScriptFiles(root));
let failed = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) failed = true;
}

if (failed) process.exitCode = 1;

function collectJavaScriptFiles(dir) {
  const result = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectJavaScriptFiles(path));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      result.push(path);
    }
  }
  return result;
}
