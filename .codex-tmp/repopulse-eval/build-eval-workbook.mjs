import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const repoRoot = "D:/Projects/RepoPulse";
const reportPath = path.join(repoRoot, "reports/2026/2026-05-18-ai-builder.md");
const outputDir = path.join(repoRoot, "outputs/repopulse-eval-2026-05-18");
const outputPath = path.join(outputDir, "RepoPulse_人工评测表_2026-05-18.xlsx");
const reviewRowCount = 20;

const report = await fs.readFile(reportPath, "utf8");
const projects = parseProjects(report);
const rows = buildReviewRows(projects, reviewRowCount);

const workbook = Workbook.create();
const guide = workbook.worksheets.add("Guide");
const review = workbook.worksheets.add("Review");
const rubric = workbook.worksheets.add("Rubric");
const summary = workbook.worksheets.add("Summary");

buildGuide(guide, projects.length);
buildReview(review, rows);
buildRubric(rubric);
buildSummary(summary);

await verifyWorkbook(workbook);
await fs.mkdir(outputDir, { recursive: true });
const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);
console.log(outputPath);

function parseProjects(markdown) {
  const sectionNames = new Set([
    "今日最值得深读",
    "上升很快，值得观察",
    "可转化为项目灵感",
    "谨慎关注"
  ]);
  const lines = markdown.split(/\r?\n/);
  const projects = [];
  let section = "";
  let current = null;

  for (const line of lines) {
    const sectionMatch = line.match(/^##\s+(.+?)\s*$/);
    if (sectionMatch && sectionNames.has(sectionMatch[1].trim())) {
      section = sectionMatch[1].trim();
      continue;
    }

    const projectMatch = line.match(/^###\s+\d+\.\s+(.+?)\s*$/);
    if (projectMatch) {
      current = {
        repo: projectMatch[1].trim(),
        section,
        level: "",
        url: "",
        summary: ""
      };
      projects.push(current);
      continue;
    }

    if (!current) continue;
    current.summary ||= extractField(line, "一句话定位");
    current.level ||= extractField(line, "推荐等级");
    current.url ||= extractField(line, "链接");
  }

  return projects;
}

function extractField(line, label) {
  const marker = `- ${label}：`;
  const start = line.indexOf(marker);
  if (start === -1) return "";

  const valueStart = start + marker.length;
  const nextMarker = line.slice(valueStart).search(/\s+- [^：]{1,16}：/);
  const value = nextMarker === -1
    ? line.slice(valueStart)
    : line.slice(valueStart, valueStart + nextMarker);
  return value.trim();
}

function buildReviewRows(projects, rowCount) {
  const rows = [];
  for (let index = 0; index < rowCount; index += 1) {
    const rowNumber = index + 2;
    const project = projects[index] || {};
    rows.push([
      index + 1,
      project.repo || "",
      project.section || "",
      project.level || "",
      project.url || "",
      project.summary || "",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      `=IF(COUNT(G${rowNumber}:L${rowNumber})=0,"",ROUND(AVERAGE(G${rowNumber}:L${rowNumber}),2))`,
      `=IF(COUNT(G${rowNumber}:L${rowNumber})=6,"已完成","待评分")`
    ]);
  }
  return rows;
}

function buildGuide(sheet, projectCount) {
  sheet.showGridLines = false;
  sheet.getRange("A1:B1").values = [["RepoPulse 朋友快评说明", ""]];
  sheet.getRange("A1:B1").format = titleFormat();
  sheet.getRange("A3:B9").values = [
    ["这份表用途", `从 2026-05-18 ai-builder 日报自动抽取 ${projectCount} 个项目，预留 20 行，方便朋友快速打分。`],
    ["建议耗时", "每位朋友只评 3 个项目即可，大约 10-15 分钟；愿意多评再补空白行。"],
    ["评分方式", "打开日报里的 GitHub 链接，结合报告内容快速核对 README、topics、release、metadata。"],
    ["1 分", "明显错误、不可信或完全不适合推荐。"],
    ["3 分", "基本可用，但证据、风险或画像匹配还有明显改进空间。"],
    ["5 分", "可信、具体、对判断是否深读很有帮助。"],
    ["主要问题", "只写一句话即可，例如：证据太泛、风险漏掉、摘要不准、推荐过强。"]
  ];
  sheet.getRange("A3:A9").format = labelFormat();
  sheet.getRange("B3:B9").format = { wrapText: true, verticalAlignment: "top" };
  sheet.getRange("A11:B11").values = [["给朋友的话", "不用读完整源码，也不用写长评。核心目标是判断：这份日报有没有帮你更快决定“值不值得点开深读”。"]];
  sheet.getRange("A11").format = labelFormat();
  sheet.getRange("B11").format = { wrapText: true, fill: "#ECFDF5", font: { color: "#065F46", bold: true } };
  setWidths(sheet, [130, 760]);
}

function buildReview(sheet, rows) {
  sheet.showGridLines = false;
  const headers = [
    "序号",
    "仓库",
    "分层",
    "推荐等级",
    "链接",
    "一句话定位",
    "摘要准确\n1-5",
    "证据质量\n1-5",
    "分数合理\n1-5",
    "阅读路径\n1-5",
    "风险识别\n1-5",
    "画像匹配\n1-5",
    "是否推荐\n是/观察/否",
    "主要问题",
    "评审人",
    "备注",
    "平均分",
    "状态"
  ];
  sheet.getRange("A1:R1").values = [headers];
  sheet.getRange("A1:R1").format = headerFormat();

  const valueRows = rows.map((row) => row.slice(0, 16));
  const formulaRows = rows.map((row) => row.slice(16));
  sheet.getRange(`A2:P${rows.length + 1}`).values = valueRows;
  sheet.getRange(`Q2:R${rows.length + 1}`).formulas = formulaRows;

  sheet.freezePanes.freezeRows(1);
  setWidths(sheet, [52, 230, 150, 90, 310, 380, 76, 76, 76, 76, 76, 76, 96, 260, 90, 170, 78, 82]);
  sheet.getRange(`A2:R${rows.length + 1}`).format = { wrapText: true, verticalAlignment: "top" };
  sheet.getRange(`G2:M${rows.length + 1}`).format = { horizontalAlignment: "center" };
  sheet.getRange(`Q2:R${rows.length + 1}`).format = { horizontalAlignment: "center", fill: "#F8FAFC" };
  sheet.getRange(`Q2:Q${rows.length + 1}`).format.numberFormat = "0.00";
  sheet.getRange(`E2:E${rows.length + 1}`).format = { font: { color: "#2563EB", underline: true }, wrapText: true };
}

function buildRubric(sheet) {
  sheet.showGridLines = false;
  sheet.getRange("A1:D1").values = [["评分口径：每项 1-5 分", "", "", ""]];
  sheet.getRange("A1:D1").format = titleFormat();
  sheet.getRange("A3:D9").values = [
    ["维度", "1 分", "3 分", "5 分"],
    ["摘要准确", "项目定位明显错误", "大体正确但不够准", "准确概括项目用途"],
    ["证据质量", "理由没有可核验证据", "有证据但比较泛", "证据具体，可回到 GitHub 核对"],
    ["分数合理", "明显高估或低估", "大致合理", "和人工判断高度一致"],
    ["阅读路径", "不具体、不可执行", "能提供方向", "步骤明确，能马上照做"],
    ["风险识别", "空泛或漏掉关键风险", "指出部分风险", "风险真实、具体、有帮助"],
    ["画像匹配", "和 AI Builder 画像关系弱", "有一定相关", "语言、topic、学习目标都匹配"]
  ];
  sheet.getRange("A3:D3").format = headerFormat();
  sheet.getRange("A4:A9").format = labelFormat();
  sheet.getRange("B4:D9").format = { wrapText: true, verticalAlignment: "top" };
  setWidths(sheet, [130, 230, 230, 270]);
}

function buildSummary(sheet) {
  sheet.showGridLines = false;
  sheet.getRange("A1:B1").values = [["评测汇总", ""]];
  sheet.getRange("A1:B1").format = titleFormat();
  sheet.getRange("A3:B8").values = [
    ["已完成项目数", null],
    ["平均总分", null],
    ["推荐：是", null],
    ["推荐：观察", null],
    ["推荐：否", null],
    ["使用建议", "先让每位朋友评 3 个项目；平均分低于 3.5 或“否”较多的项目，优先回看推荐理由、证据和风险。"]
  ];
  sheet.getRange("B3:B7").formulas = [
    ['=COUNTIF(Review!R2:R21,"已完成")'],
    ['=IFERROR(ROUND(AVERAGE(Review!Q2:Q21),2),"")'],
    ['=COUNTIF(Review!M2:M21,"是")'],
    ['=COUNTIF(Review!M2:M21,"观察")'],
    ['=COUNTIF(Review!M2:M21,"否")']
  ];
  sheet.getRange("A3:A8").format = labelFormat();
  sheet.getRange("B3:B7").format = { fill: "#F8FAFC", font: { bold: true }, horizontalAlignment: "center" };
  sheet.getRange("B8").format = { wrapText: true, fill: "#EFF6FF", font: { color: "#1E3A8A" } };
  setWidths(sheet, [150, 650]);
}

function setWidths(sheet, widths) {
  widths.forEach((width, index) => {
    sheet.getCell(0, index).format.columnWidthPx = width;
  });
}

function titleFormat() {
  return {
    fill: "#111827",
    font: { bold: true, color: "#FFFFFF", size: 15 },
    horizontalAlignment: "left",
    verticalAlignment: "middle"
  };
}

function headerFormat() {
  return {
    fill: "#1F2937",
    font: { bold: true, color: "#FFFFFF" },
    horizontalAlignment: "center",
    verticalAlignment: "middle",
    wrapText: true
  };
}

function labelFormat() {
  return {
    fill: "#F1F5F9",
    font: { bold: true, color: "#0F172A" },
    wrapText: true
  };
}

async function verifyWorkbook(workbook) {
  const reviewPreview = await workbook.inspect({
    kind: "table",
    range: "Review!A1:R8",
    include: "values,formulas",
    tableMaxRows: 8,
    tableMaxCols: 18,
    maxChars: 3000
  });
  console.log(reviewPreview.ndjson);

  const summaryPreview = await workbook.inspect({
    kind: "table",
    range: "Summary!A1:B8",
    include: "values,formulas",
    tableMaxRows: 8,
    tableMaxCols: 2,
    maxChars: 1200
  });
  console.log(summaryPreview.ndjson);

  const errors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 50 },
    summary: "formula error scan",
    maxChars: 2000
  });
  console.log(errors.ndjson);

  await workbook.render({ sheetName: "Guide", autoCrop: "all", scale: 1, format: "png" });
  await workbook.render({ sheetName: "Review", range: "A1:R8", scale: 1, format: "png" });
  await workbook.render({ sheetName: "Rubric", autoCrop: "all", scale: 1, format: "png" });
  await workbook.render({ sheetName: "Summary", autoCrop: "all", scale: 1, format: "png" });
}
