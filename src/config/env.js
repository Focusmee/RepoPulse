import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadDotEnv();

export function getRuntimeConfig(env = process.env) {
  return {
    githubToken: env.GITHUB_TOKEN || "",
    openaiApiKey: env.OPENAI_API_KEY || "",
    openaiModel: env.OPENAI_MODEL || "",
    openaiBaseUrl: env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    storePath: env.REPOPULSE_STORE_PATH || "data/repopulse.store.json",
    timeZone: env.REPOPULSE_TIMEZONE || "Asia/Shanghai"
  };
}

function loadDotEnv(path = ".env") {
  const absolutePath = resolve(path);
  if (!existsSync(absolutePath)) return;
  const text = readFileSync(absolutePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}
