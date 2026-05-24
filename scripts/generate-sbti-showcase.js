#!/usr/bin/env node
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateSbtiProfile, renderPersonaResultHtml } from "../src/persona/index.js";
import { readJson, writeJsonAtomic, writeText } from "../src/shared/fs.js";

const SHOWCASE_CASES = Object.freeze([
  {
    id: "sbti",
    title: "火速开搞型",
    description: "面向 developer tools、quick demo 和半天 demo 验证。",
    answersPath: "examples/sbti/sbti.answers.json"
  },
  {
    id: "smpc",
    title: "产品化雷达型",
    description: "面向 startup validation、产品机会和 2-3 天验证。",
    answersPath: "examples/sbti/smpc.answers.json"
  },
  {
    id: "rbpc",
    title: "稳健落地派",
    description: "面向 enterprise workflow、工作自动化和 1-2 周试点。",
    answersPath: "examples/sbti/rbpc.answers.json"
  }
]);

if (isMain(import.meta.url)) {
  await main();
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  try {
    if (flags.help || flags.h) {
      printHelp();
    } else {
      const outputDir = resolve(flags.output || "outputs/sbti-showcase");
      const manifest = await generateShowcase(outputDir);
      printSummary(manifest);
    }
  } catch (error) {
    console.error(`SBTI showcase 生成失败：${error.message}`);
    if (flags.debug) console.error(error.stack);
    process.exitCode = 1;
  }
}

export async function generateShowcase(outputDir) {
  const cases = [];

  for (const showcaseCase of SHOWCASE_CASES) {
    const payload = await readJson(resolve(showcaseCase.answersPath), null);
    if (!payload?.answers) throw new Error(`样例答案缺少 answers：${showcaseCase.answersPath}`);

    const result = generateSbtiProfile({ answers: payload.answers, generatedBy: "scripts/generate-sbti-showcase.js" });
    const caseDir = resolve(outputDir, showcaseCase.id);
    const profilePath = resolve(caseDir, "profile.json");
    const personaResultPath = resolve(caseDir, "persona-result.json");
    const personaHtmlPath = resolve(caseDir, "persona-result.html");

    await writeJsonAtomic(profilePath, result.profile);
    await writeJsonAtomic(personaResultPath, result.personaResult);
    await writeText(personaHtmlPath, renderPersonaResultHtml(result.personaResult));

    cases.push({
      id: showcaseCase.id,
      title: showcaseCase.title,
      description: showcaseCase.description,
      answers_path: toPortablePath(showcaseCase.answersPath),
      profile_path: toPortablePath(relative(process.cwd(), profilePath)),
      persona_result_path: toPortablePath(relative(process.cwd(), personaResultPath)),
      persona_result_html_path: toPortablePath(relative(process.cwd(), personaHtmlPath)),
      raw_code: result.sbtiResult.rawCode,
      persona_code: result.sbtiResult.personaCode,
      persona_name: result.sbtiResult.personaName,
      profile_id: result.profile.profile_id,
      report_command: `npm run report -- --profile ${toPortablePath(relative(process.cwd(), profilePath))} --limit 8 --dry-run`,
      recommendation_strategy: result.personaResult.recommendationStrategy
    });
  }

  const manifest = {
    generated_by: "scripts/generate-sbti-showcase.js",
    output_dir: toPortablePath(relative(process.cwd(), outputDir)),
    cases
  };

  await writeJsonAtomic(resolve(outputDir, "manifest.json"), manifest);
  return manifest;
}

function parseFlags(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const token = values[index];
    if (!token.startsWith("--") && !token.startsWith("-")) continue;
    const normalized = token.replace(/^-+/, "");
    const [key, inlineValue] = normalized.split("=");
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

function printSummary(manifest) {
  console.log(`SBTI v1 showcase 已生成：${manifest.output_dir}`);
  for (const item of manifest.cases) {
    console.log(`- ${item.persona_code} / ${item.persona_name} -> ${item.profile_path}`);
    console.log(`  下一步：${item.report_command}`);
  }
}

function printHelp() {
  console.log(`RepoPulse SBTI showcase generator

用法：
  node scripts/generate-sbti-showcase.js
  node scripts/generate-sbti-showcase.js --output outputs/sbti-showcase

参数：
  --output <dir>  写入 showcase 生成物的目录，默认 outputs/sbti-showcase
  --debug         打印错误堆栈
`);
}

function toPortablePath(path) {
  return String(path || "").replace(/\\/g, "/");
}

function isMain(url) {
  return resolve(fileURLToPath(url)) === resolve(process.argv[1] || "");
}
