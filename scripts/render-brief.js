#!/usr/bin/env node
import { basename, extname, join } from "node:path";
import { extractBriefFromMarkdown } from "../src/reports/extractBriefFromMarkdown.js";
import { renderBriefHtml } from "../src/reports/renderBriefHtml.js";
import { readText, writeText } from "../src/shared/fs.js";

const flags = parseFlags(process.argv.slice(2));

try {
  if (!flags.input) {
    throw new Error("缺少 --input <report.md>");
  }

  const markdown = await readText(flags.input, null);
  if (markdown === null) {
    throw new Error(`找不到输入报告：${flags.input}`);
  }

  const brief = extractBriefFromMarkdown(markdown, {
    topLimit: Number(flags.top || 3),
    inspirationLimit: Number(flags.inspiration || 2)
  });
  const html = renderBriefHtml(brief, {
    ctaUrl: flags["cta-url"] || "",
    ctaLabel: flags["cta-label"] || "",
    fullReportUrl: flags["full-report-url"] || ""
  });
  const outputPath = flags.output || defaultOutputPath(flags.input);

  await writeText(outputPath, html);

  for (const warning of brief.warnings || []) {
    console.warn(`RepoPulse brief warning: ${warning}`);
  }
  console.log(`RepoPulse brief generated: ${outputPath}`);
} catch (error) {
  console.error(`RepoPulse brief failed: ${error.message}`);
  if (flags.debug) console.error(error.stack);
  process.exitCode = 1;
}

function parseFlags(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const token = values[index];
    if (!token.startsWith("--")) continue;
    const normalized = token.slice(2);
    const [key, inlineValue] = normalized.split("=");
    const nextValue = values[index + 1];
    if (inlineValue !== undefined) {
      result[key] = inlineValue;
    } else if (!nextValue || nextValue.startsWith("--")) {
      result[key] = true;
    } else {
      result[key] = nextValue;
      index += 1;
    }
  }
  return result;
}

function defaultOutputPath(inputPath) {
  const name = basename(inputPath, extname(inputPath));
  return join("outputs", "brief", `${name}.html`);
}
