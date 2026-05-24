#!/usr/bin/env node
import { extname, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import {
  generateSbtiProfile,
  SAMPLE_SBTI_ANSWERS,
  getQuestionOption,
  getQuestionOptionValues,
  getSbtiQuestions,
  renderPersonaResultHtml
} from "../src/persona/index.js";
import { readJson, writeJsonAtomic, writeText } from "../src/shared/fs.js";

const flags = parseFlags(process.argv.slice(2));

try {
  if (flags.help || flags.h) {
    printHelp();
  } else {
    const input = await loadInput(flags);
    const result = generateSbtiProfile({ answers: input.answers });
    printResult(result, flags.output);

    if (flags.output) {
      await writeJsonAtomic(resolve(flags.output), result.profile);
      console.log(`profile 已写入：${resolve(flags.output)}`);
    } else {
      console.log("profile 已生成。未指定 --output，下面打印 JSON：");
      console.log(JSON.stringify(result.profile, null, 2));
    }

    if (flags["result-output"]) {
      await writePersonaResult(resolve(flags["result-output"]), result.personaResult);
      console.log(`persona 结果已写入：${resolve(flags["result-output"])}`);
    }

    if (flags["print-result-json"]) {
      console.log("personaResult JSON：");
      console.log(JSON.stringify(result.personaResult, null, 2));
    }
  }
} catch (error) {
  console.error(`SBTI profile 生成失败：${error.message}`);
  if (flags.debug) console.error(error.stack);
  process.exitCode = 1;
}

async function writePersonaResult(path, personaResult) {
  if (extname(path).toLowerCase() === ".html") {
    await writeText(path, renderPersonaResultHtml(personaResult));
    return;
  }
  await writeJsonAtomic(path, personaResult);
}

async function loadInput(parsedFlags) {
  if (parsedFlags.sample) {
    return { answers: SAMPLE_SBTI_ANSWERS };
  }

  if (parsedFlags.interactive) {
    return { answers: await collectInteractiveAnswers() };
  }

  if (parsedFlags.input) {
    const inputPath = resolve(parsedFlags.input);
    const payload = await readJson(inputPath, null);
    if (!payload) throw new Error(`找不到输入文件：${inputPath}`);
    if (!payload.answers || typeof payload.answers !== "object") {
      throw new Error("输入 JSON 必须包含 answers 对象");
    }
    return payload;
  }

  throw new Error("请使用 --sample，或提供 --input <answers.json>");
}

function printResult({ sbtiResult, personaResult }, outputPath) {
  console.log(`你是：${sbtiResult.personaCode} / ${sbtiResult.sbtiType.name}`);
  if (sbtiResult.resolvedBy === "alias") {
    console.log(`原始代码：${sbtiResult.rawCode}，已映射到核心人格：${sbtiResult.personaCode}`);
  }
  console.log(`搞怪描述：${sbtiResult.sbtiType.funnyDescription}`);
  console.log(`认真画像：${sbtiResult.sbtiType.seriousDescription}`);
  console.log(
    `画像摘要：${personaResult.profileSummary.industry || "未设置"}；${personaResult.profileSummary.goal || "未设置"}；${
      personaResult.profileSummary.timeBudget || "未设置"
    }；卡点：${personaResult.profileSummary.painPoint || "未设置"}`
  );
  console.log("推荐策略：");
  for (const strategy of personaResult.recommendationStrategy) {
    console.log(`- ${strategy}`);
  }
  if (outputPath) {
    console.log("profile 已生成。");
    console.log(`下一步可运行：npm run report -- --profile ${outputPath} --limit 8`);
  }
}

async function collectInteractiveAnswers() {
  if (!process.stdin.isTTY) {
    return collectAnswersFromBufferedInput(readFileSync(0, "utf8"));
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: Boolean(process.stdin.isTTY && process.stdout.isTTY)
  });
  const answers = {};

  try {
    console.log("RepoPulse SBTI AI 开发者画像测试");
    console.log("输入选项值或序号；输入 q / quit / exit 可退出。\n");

    for (const question of getSbtiQuestions()) {
      answers[question.id] = await askQuestionUntilValid(rl, question);
      console.log("");
    }
    return answers;
  } finally {
    rl.close();
  }
}

function collectAnswersFromBufferedInput(text) {
  const lines = String(text || "").split(/\r?\n/);
  const answers = {};
  let lineIndex = 0;

  console.log("RepoPulse SBTI AI 开发者画像测试");
  console.log("输入选项值或序号；输入 q / quit / exit 可退出。\n");

  for (const question of getSbtiQuestions()) {
    while (true) {
      printQuestion(question);
      if (lineIndex >= lines.length) throw new Error(`交互输入不足：${question.id}`);

      const rawAnswer = lines[lineIndex++];
      const normalized = normalizeInteractiveAnswer(question, rawAnswer);
      if (["q", "quit", "exit"].includes(String(rawAnswer || "").trim().toLowerCase())) {
        throw new Error("已取消 SBTI 交互测试");
      }
      if (getQuestionOption(question.id, normalized)) {
        answers[question.id] = normalized;
        console.log("");
        break;
      }
      console.log(`无效选项，请输入：${getQuestionOptionValues(question.id).join(", ")}，或输入序号 1-${question.options.length}。`);
    }
  }

  return answers;
}

async function askQuestionUntilValid(rl, question) {
  while (true) {
    printQuestion(question);
    const rawAnswer = await rl.question("> ");
    const normalized = normalizeInteractiveAnswer(question, rawAnswer);

    if (["q", "quit", "exit"].includes(String(rawAnswer || "").trim().toLowerCase())) {
      throw new Error("已取消 SBTI 交互测试");
    }
    if (getQuestionOption(question.id, normalized)) return normalized;

    console.log(`无效选项，请输入：${getQuestionOptionValues(question.id).join(", ")}，或输入序号 1-${question.options.length}。`);
  }
}

function printQuestion(question) {
  console.log(`${question.id.toUpperCase()}. ${question.text}`);
  question.options.forEach((option, index) => {
    console.log(`  ${index + 1}. ${option.value} - ${option.label}`);
  });
}

function normalizeInteractiveAnswer(question, rawAnswer) {
  const text = String(rawAnswer || "").trim();
  const number = Number(text);
  if (Number.isInteger(number) && number >= 1 && number <= question.options.length) {
    return question.options[number - 1].value;
  }
  return question.kind === "dimension" ? text.toUpperCase() : text;
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

function printHelp() {
  console.log(`RepoPulse SBTI profile generator

用法：
  node scripts/generate-sbti-profile.js --sample
  node scripts/generate-sbti-profile.js --interactive --output config/profiles/sbti-generated.json
  node scripts/generate-sbti-profile.js --input examples/sbti-answer.sample.json --output config/profiles/sbti-generated.json

参数：
  --sample          使用内置模拟答案
  --interactive     在终端逐题完成 SBTI 测试
  --input <path>    读取包含 answers 的 JSON
  --output <path>   写入生成的 RepoPulse profile JSON
  --result-output <path>  写入 personaResult；.html 后缀会生成本地结果页，否则写 JSON
  --print-result-json  同时打印未来 UI / 图文生成器可用的 personaResult JSON
  --debug           打印错误堆栈
`);
}
