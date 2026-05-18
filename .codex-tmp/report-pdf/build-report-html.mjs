import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = "D:/Projects/RepoPulse";
const reportPath = path.join(repoRoot, "reports/2026/2026-05-18-ai-builder.md");
const outputDir = path.join(repoRoot, "outputs/repopulse-report-2026-05-18");
const outputPath = path.join(outputDir, "RepoPulse_AI_Builder_Daily_2026-05-18.html");

const markdown = await fs.readFile(reportPath, "utf8");
const report = parseReport(markdown);
const html = renderHtml(report);

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(outputPath, html, "utf8");
console.log(outputPath);

function parseReport(markdownText) {
  const lines = normalizeMarkdown(markdownText).split(/\r?\n/);
  const title = lines.find((line) => line.startsWith("# "))?.replace(/^#\s+/, "").trim() || "RepoPulse 日报";
  const profileLine = lines.find((line) => line.startsWith("画像：")) || "";
  const sections = [];
  let current = null;

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      current = { title: h2[1].trim(), lines: [] };
      sections.push(current);
      continue;
    }
    if (current && !line.startsWith("# ")) current.lines.push(line);
  }

  return {
    title,
    profileLine,
    conclusion: parseSimpleSection(findSection(sections, "今日结论")),
    overview: parseSimpleSection(findSection(sections, "运行概览")),
    projectSections: ["今日最值得深读", "上升很快，值得观察", "可转化为项目灵感", "谨慎关注"]
      .map((sectionTitle) => ({
        title: sectionTitle,
        projects: parseProjects(findSection(sections, sectionTitle))
      }))
      .filter((section) => section.projects.length > 0),
    qualityWarnings: parseSimpleSection(findSection(sections, "质量警告")),
    usage: parseSimpleSection(findSection(sections, "使用建议"))
  };
}

function normalizeMarkdown(text) {
  return text
    .replace(/\r/g, "")
    .replace(/：\s{2,}- /g, "：\n  - ")
    .replace(/([。；])\s{2,}(\d+\.\s+)/g, "$1\n  $2")
    .replace(/([^\n])\s{2,}- (GitHub metadata|README|release|topics|license|趋势信号|社区信号|近期活跃|匹配说明|语言\/主题信号|medium|low|high)：/g, "$1\n  - $2：");
}

function findSection(sections, title) {
  return sections.find((section) => section.title === title)?.lines || [];
}

function parseSimpleSection(lines) {
  return lines.filter((line) => line.trim()).map((line) => line.trim());
}

function parseProjects(lines) {
  const projects = [];
  let current = null;

  for (const line of lines) {
    const h3 = line.match(/^###\s+\d+\.\s+(.+?)\s*$/);
    if (h3) {
      current = { repo: h3[1].trim(), raw: [] };
      projects.push(current);
      continue;
    }
    if (current) current.raw.push(line);
  }

  return projects.map((project) => {
    const fields = parseProjectFields(project.raw);
    return {
      repo: project.repo,
      fields,
      summary: fields.get("一句话定位") || "",
      level: fields.get("推荐等级") || "",
      type: fields.get("项目类型") || "",
      scores: parseScores(fields.get("综合分") || ""),
      confidence: fields.get("置信度") || "",
      facts: fields.get("事实来源") || "",
      attention: fields.get("为什么值得关注") || "",
      learning: fields.get("为什么值得学习") || "",
      reason: fields.get("推荐理由与证据") || "",
      profile: fields.get("为什么适合当前画像") || "",
      path: fields.get("推荐阅读路径") || "",
      idea: fields.get("可转化项目想法") || "",
      risks: fields.get("风险") || "",
      url: fields.get("链接") || ""
    };
  });
}

function parseProjectFields(lines) {
  const fields = new Map();
  let currentKey = null;
  let currentValue = [];

  const commit = () => {
    if (!currentKey) return;
    fields.set(currentKey, currentValue.join("\n").trim());
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const topLevel = line.match(/^- ([^：]{1,24})：(.*)$/);
    if (topLevel) {
      commit();
      currentKey = topLevel[1].trim();
      currentValue = [topLevel[2].trim()];
      continue;
    }
    if (currentKey && line.trim()) currentValue.push(line);
  }
  commit();
  return fields;
}

function parseScores(scoreText) {
  const scorePairs = [];
  for (const part of scoreText.split(/[；;]/)) {
    const match = part.match(/(.+?)：\s*([0-9.]+)/);
    if (match) scorePairs.push({ label: match[1].trim(), value: match[2] });
  }
  return scorePairs;
}

function renderHtml(report) {
  const projectCount = report.projectSections.reduce((sum, section) => sum + section.projects.length, 0);
  const warningCount = report.qualityWarnings.filter((line) => line.startsWith("- ")).length;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(report.title)}</title>
  <style>${css()}</style>
</head>
<body>
  <main class="page">
    <section class="cover">
      <div class="brand">RepoPulse</div>
      <h1>${escapeHtml(report.title)}</h1>
      <p class="subtitle">AI Builder 趋势项目可信日报 · 朋友评审分享版</p>
      ${report.profileLine ? `<p class="profile">${escapeHtml(report.profileLine)}</p>` : ""}
      <div class="stats">
        <div><strong>${projectCount}</strong><span>推荐项目</span></div>
        <div><strong>${report.projectSections.length}</strong><span>内容分层</span></div>
        <div><strong>${warningCount}</strong><span>质量警告</span></div>
      </div>
    </section>

    <section class="panel">
      <div class="section-title">
        <span>01</span>
        <h2>今日结论</h2>
      </div>
      ${renderLines(report.conclusion, "lead")}
    </section>

    <section class="panel compact">
      <div class="section-title">
        <span>02</span>
        <h2>运行概览</h2>
      </div>
      <div class="overview-grid">${renderOverview(report.overview)}</div>
    </section>

    ${report.projectSections.map((section, index) => renderProjectSection(section, index + 3)).join("\n")}

    <section class="panel compact">
      <div class="section-title">
        <span>${String(report.projectSections.length + 3).padStart(2, "0")}</span>
        <h2>质量警告</h2>
      </div>
      ${renderWarningList(report.qualityWarnings)}
    </section>

    <section class="panel compact">
      <div class="section-title">
        <span>${String(report.projectSections.length + 4).padStart(2, "0")}</span>
        <h2>使用建议</h2>
      </div>
      ${renderLines(report.usage, "plain")}
    </section>
  </main>
</body>
</html>`;
}

function renderOverview(lines) {
  return lines
    .filter((line) => line.startsWith("- "))
    .map((line) => {
      const text = line.replace(/^- /, "");
      const [label, ...rest] = text.split("：");
      return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(rest.join("：") || "-")}</strong></div>`;
    })
    .join("");
}

function renderProjectSection(section, number) {
  const tone = toneForSection(section.title);
  return `<section class="project-section">
    <div class="section-heading ${tone}">
      <div>
        <span>${String(number).padStart(2, "0")}</span>
        <h2>${escapeHtml(section.title)}</h2>
      </div>
      <p>${sectionHint(section.title)}</p>
    </div>
    ${section.projects.map((project) => renderProjectCard(project, tone)).join("\n")}
  </section>`;
}

function renderProjectCard(project, tone) {
  return `<article class="project-card ${tone}">
    <header class="project-header">
      <div>
        <h3>${escapeHtml(project.repo)}</h3>
        <p>${escapeHtml(project.summary)}</p>
      </div>
      <div class="badges">
        ${project.level ? `<span>${escapeHtml(project.level)}</span>` : ""}
        ${project.url ? `<a href="${escapeAttr(project.url)}">GitHub</a>` : ""}
      </div>
    </header>
    <div class="score-row">
      ${project.scores.map((score) => `<div><span>${escapeHtml(score.label)}</span><strong>${escapeHtml(score.value)}</strong></div>`).join("")}
    </div>
    <div class="mini-note">${escapeHtml(project.type || project.confidence)}</div>
    <div class="detail-grid">
      ${renderDetail("事实来源", project.facts, "source")}
      ${renderDetail("为什么值得关注", project.attention, "attention")}
      ${renderDetail("为什么值得学习", project.learning || project.reason, "learn")}
      ${renderDetail("为什么适合当前画像", project.profile, "profile-fit")}
      ${project.idea ? renderDetail("可转化项目想法", project.idea, "idea") : ""}
      ${renderDetail("风险", project.risks, "risk")}
      ${project.path ? renderDetail("推荐阅读路径", project.path, "path wide") : ""}
    </div>
  </article>`;
}

function renderDetail(title, content, className) {
  if (!content) return "";
  return `<div class="detail ${className}">
    <h4>${escapeHtml(title)}</h4>
    ${renderMarkdownish(content)}
  </div>`;
}

function renderWarningList(lines) {
  if (!lines.length) return `<p class="plain">本次报告未发现质量警告。</p>`;
  return `<div class="warnings">${lines.map((line) => `<p>${escapeHtml(line.replace(/^- /, ""))}</p>`).join("")}</div>`;
}

function renderLines(lines, className) {
  if (!lines.length) return "";
  return `<div class="${className}">${lines.map((line) => renderMarkdownish(line)).join("")}</div>`;
}

function renderMarkdownish(text) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const out = [];
  let list = null;

  const closeList = () => {
    if (!list) return;
    out.push(`</${list}>`);
    list = null;
  };

  for (const line of lines) {
    const bullet = line.match(/^- (.+)$/);
    const number = line.match(/^\d+\.\s+(.+)$/);
    if (bullet) {
      if (list !== "ul") {
        closeList();
        out.push("<ul>");
        list = "ul";
      }
      out.push(`<li>${linkify(escapeHtml(bullet[1]))}</li>`);
      continue;
    }
    if (number) {
      if (list !== "ol") {
        closeList();
        out.push("<ol>");
        list = "ol";
      }
      out.push(`<li>${linkify(escapeHtml(number[1]))}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${linkify(escapeHtml(line))}</p>`);
  }
  closeList();
  return out.join("");
}

function sectionHint(title) {
  const hints = {
    "今日最值得深读": "学习价值高、证据足、画像匹配强，适合优先打开 README。",
    "上升很快，值得观察": "趋势信号强，但成熟度或证据仍需观察。",
    "可转化为项目灵感": "适合复刻、二次开发、写简历项目。",
    "谨慎关注": "热度存在，但风险明显，建议先核验再投入时间。"
  };
  return hints[title] || "";
}

function toneForSection(title) {
  if (title.includes("深读")) return "deep";
  if (title.includes("观察")) return "watch";
  if (title.includes("灵感")) return "idea";
  return "caution";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function linkify(escapedText) {
  return escapedText.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
}

function css() {
  return `
@page {
  size: A4;
  margin: 14mm 12mm;
}
* {
  box-sizing: border-box;
}
html {
  font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", Arial, sans-serif;
  color: #172033;
  background: #f4f7fb;
}
body {
  margin: 0;
  background:
    radial-gradient(circle at top left, rgba(59,130,246,.16), transparent 28%),
    linear-gradient(180deg, #f7fafc 0%, #eef4f8 100%);
}
a {
  color: #2563eb;
  text-decoration: none;
}
.page {
  max-width: 1040px;
  margin: 0 auto;
}
.cover {
  min-height: 320px;
  padding: 36px;
  margin-bottom: 18px;
  border-radius: 18px;
  background:
    linear-gradient(135deg, rgba(15,23,42,.96), rgba(24,75,112,.94)),
    #111827;
  color: #fff;
  position: relative;
  overflow: hidden;
}
.cover::after {
  content: "";
  position: absolute;
  width: 360px;
  height: 360px;
  right: -120px;
  top: -160px;
  border: 1px solid rgba(255,255,255,.18);
  border-radius: 50%;
}
.brand {
  display: inline-block;
  padding: 6px 10px;
  border: 1px solid rgba(255,255,255,.25);
  border-radius: 999px;
  color: #c7d2fe;
  font-size: 12px;
  letter-spacing: .08em;
  text-transform: uppercase;
}
h1 {
  margin: 28px 0 12px;
  font-size: 34px;
  line-height: 1.18;
}
.subtitle {
  margin: 0;
  font-size: 16px;
  color: #dbeafe;
}
.profile {
  width: 86%;
  margin: 22px 0 0;
  color: #d1d5db;
  line-height: 1.8;
}
.stats {
  display: flex;
  gap: 14px;
  margin-top: 28px;
}
.stats div {
  min-width: 116px;
  padding: 14px;
  border-radius: 12px;
  background: rgba(255,255,255,.1);
  border: 1px solid rgba(255,255,255,.14);
}
.stats strong {
  display: block;
  font-size: 26px;
}
.stats span {
  color: #cbd5e1;
  font-size: 12px;
}
.panel, .project-card {
  background: rgba(255,255,255,.95);
  border: 1px solid #dce7f3;
  border-radius: 16px;
  padding: 22px;
  margin-bottom: 16px;
  box-shadow: 0 12px 30px rgba(15,23,42,.06);
}
.compact {
  padding: 18px 20px;
}
.section-title, .section-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.section-title span, .section-heading span {
  display: inline-grid;
  place-items: center;
  min-width: 34px;
  height: 28px;
  border-radius: 999px;
  background: #e0f2fe;
  color: #0369a1;
  font-weight: 700;
  font-size: 12px;
}
h2 {
  margin: 0;
  font-size: 21px;
}
.lead p, .plain p {
  margin: 8px 0;
  line-height: 1.85;
}
.overview-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.metric {
  padding: 12px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.metric span {
  display: block;
  color: #64748b;
  font-size: 12px;
}
.metric strong {
  display: block;
  margin-top: 5px;
  font-size: 15px;
  color: #0f172a;
}
.project-section {
  margin: 20px 0 24px;
}
.section-heading {
  justify-content: space-between;
  padding: 18px 20px;
  border-radius: 16px;
  color: #fff;
  break-after: avoid;
}
.section-heading > div {
  display: flex;
  align-items: center;
  gap: 12px;
}
.section-heading p {
  max-width: 420px;
  margin: 0;
  color: rgba(255,255,255,.82);
  line-height: 1.6;
  font-size: 13px;
}
.section-heading.deep { background: linear-gradient(135deg, #0f766e, #155e75); }
.section-heading.watch { background: linear-gradient(135deg, #1d4ed8, #0369a1); }
.section-heading.idea { background: linear-gradient(135deg, #7c3aed, #be185d); }
.section-heading.caution { background: linear-gradient(135deg, #92400e, #991b1b); }
.project-card {
  page-break-inside: avoid;
  border-left: 6px solid #0f766e;
}
.project-card.watch { border-left-color: #2563eb; }
.project-card.idea { border-left-color: #9333ea; }
.project-card.caution { border-left-color: #b45309; }
.project-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 14px;
}
h3 {
  margin: 0;
  font-size: 22px;
  color: #111827;
}
.project-header p {
  margin: 8px 0 0;
  color: #475569;
  line-height: 1.65;
}
.badges {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  min-width: 88px;
}
.badges span, .badges a {
  display: inline-block;
  border-radius: 999px;
  padding: 6px 10px;
  background: #f1f5f9;
  color: #0f172a;
  font-size: 12px;
  font-weight: 700;
}
.badges a {
  background: #dbeafe;
  color: #1d4ed8;
}
.score-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin: 14px 0 8px;
}
.score-row div {
  padding: 10px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.score-row span {
  display: block;
  color: #64748b;
  font-size: 12px;
}
.score-row strong {
  display: block;
  margin-top: 2px;
  font-size: 20px;
  color: #0f172a;
}
.mini-note {
  margin-bottom: 12px;
  color: #475569;
  line-height: 1.65;
  font-size: 13px;
}
.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.detail {
  padding: 12px 13px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #fbfdff;
}
.detail.wide {
  grid-column: 1 / -1;
}
.detail h4 {
  margin: 0 0 8px;
  font-size: 14px;
  color: #0f172a;
}
.detail p, .detail li {
  color: #334155;
  line-height: 1.7;
  font-size: 12.6px;
}
.detail p {
  margin: 6px 0;
}
ul, ol {
  margin: 6px 0 0 18px;
  padding: 0;
}
li {
  margin: 4px 0;
}
.source { background: #f8fafc; }
.attention { background: #eff6ff; }
.learn { background: #ecfdf5; }
.profile-fit { background: #f5f3ff; }
.idea { background: #fdf4ff; }
.risk { background: #fff7ed; }
.path { background: #f9fafb; }
.warnings p {
  margin: 8px 0;
  padding: 10px 12px;
  border-left: 4px solid #f59e0b;
  background: #fffbeb;
  border-radius: 8px;
  line-height: 1.65;
  color: #713f12;
}
@media print {
  html, body {
    background: #fff;
  }
  .cover, .panel, .project-card, .section-heading {
    box-shadow: none;
  }
}`;
}
