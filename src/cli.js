#!/usr/bin/env node
import { resolve } from "node:path";
import { runDailyDigest } from "./jobs/dailyDigest.js";
import { getRuntimeConfig } from "./config/env.js";
import { listProfiles } from "./config/profile.js";
import { createLogger } from "./shared/logger.js";
import { parseRunCliOptions } from "./config/options.js";

const args = process.argv.slice(2);
const command = args[0] || "help";
const flags = parseFlags(args.slice(1));

try {
  if (command === "run") {
    const runOptions = parseRunCliOptions(flags);
    await runDailyDigest({
      ...runOptions,
      logger: createLogger({ quiet: Boolean(flags.quiet) })
    });
  } else if (command === "doctor") {
    await doctor();
  } else if (command === "profiles") {
    await printProfiles();
  } else {
    printHelp();
  }
} catch (error) {
  console.error(`\nRepoPulse 执行失败：${error.message}`);
  if (flags.debug) console.error(error.stack);
  process.exitCode = 1;
}

function parseFlags(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const token = values[index];
    if (!token.startsWith("--") && !token.startsWith("-")) continue;
    const normalized = token.replace(/^-+/, "");
    const [rawKey, inlineValue] = normalized.split("=");
    const key = rawKey;
    const nextValue = values[index + 1];
    if (inlineValue !== undefined) {
      result[key] = inlineValue;
    } else if (!nextValue || nextValue.startsWith("-")) {
      result[key] = true;
    } else {
      result[key] = nextValue;
      index += 1;
    }
  }
  return result;
}

async function doctor() {
  const runtime = getRuntimeConfig();
  console.log("RepoPulse 环境检查");
  console.log(`- Node.js：${process.version}`);
  console.log(`- 工作目录：${process.cwd()}`);
  console.log(`- Store：${resolve(runtime.storePath)}`);
  console.log(`- GITHUB_TOKEN：${runtime.githubToken ? "已设置" : "未设置，可运行但限流较低"}`);
  console.log(`- OPENAI_API_KEY：${runtime.openaiApiKey ? "已设置" : "未设置，将使用本地规则分析"}`);
  console.log(`- OPENAI_MODEL：${runtime.openaiModel || "未设置"}`);
  console.log(`- 时区：${runtime.timeZone}`);
  console.log("\n可用画像：");
  await printProfiles("  ");
}

async function printProfiles(prefix = "") {
  const profiles = await listProfiles();
  for (const profile of profiles) {
    console.log(`${prefix}- ${profile.id}: ${profile.path}`);
  }
}

function printHelp() {
  console.log(`RepoPulse - GitHub 项目学习价值日报

用法：
  node src/cli.js run [options]
  npm run report -- [options]

命令：
  run        生成一份日报
  doctor     检查本地环境和配置
  profiles   列出可用用户画像

常用参数：
  --profile <path>          用户画像 JSON，默认 config/profiles/default.json
  --watchlist <path>        watchlist JSON，默认 config/watchlist.json
  --date <YYYY-MM-DD>       指定日报日期，默认当前日期
  --limit <n>               最终推荐数量，默认读取画像 daily_limit
  --max-candidates <n>      最大候选项目数，默认 80
  --max-analyze <n>         进入 README/AI 分析的项目数，默认 20
  --max-search-queries <n>  最大 Search 查询数；未设置 token 时默认 4，已设置 token 时默认 10
  --per-search-query <n>    每个 Search 查询返回数量，默认 12
  --output <path>           指定报告输出路径
  --store <path>            指定本地 store 文件
  --no-ai                   强制使用本地规则分析
  --no-trending             不抓取 GitHub Trending，只用 Search/watchlist
  --dry-run                 只运行不写入报告和 store

示例：
  npm run doctor
  npm run report -- --profile config/profiles/ai-builder.json --limit 8
  npm run report -- --no-ai --max-candidates 40 --max-analyze 12
`);
}
