import { safePlainUrl } from "../shared/markdown.js";

export function renderBriefHtml(brief, options = {}) {
  const ctaUrl = safePlainUrl(options.ctaUrl || "");
  const fullReportUrl = safePlainUrl(options.fullReportUrl || "");
  const ctaLabel = options.ctaLabel || "申请试读 / 订阅 AI Builder Radar";
  const title = brief.title || "RepoPulse 精华版";

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
${briefCss()}
  </style>
</head>
<body>
  <main class="page">
    <section class="issue-header">
      <div class="brand-row">
        <span class="brand-name">RepoPulse</span>
        <span class="brand-divider">/</span>
        <span class="product-name">AI Builder Radar</span>
        ${brief.date ? `<span class="issue-date">${escapeHtml(brief.date)}</span>` : ""}
      </div>
      <div class="hero-grid">
        <div class="issue-title">
          <p class="kicker">GitHub 项目情报简报</p>
          <h1>${escapeHtml(title)}</h1>
          ${brief.profileLine ? `<p class="profile">${escapeHtml(brief.profileLine)}</p>` : ""}
        </div>
        ${brief.conclusion ? `<aside class="insight-panel"><span>今日主判断</span><p>${escapeHtml(brief.conclusion)}</p></aside>` : ""}
      </div>
      ${renderStats(brief.stats)}
    </section>

    <section class="section">
      <div class="section-header">
        <span class="section-index">01</span>
        <div>
          <h2>Top 3 值得点开的项目</h2>
          <p class="section-note">先看结论，再看场景、风险和下一步动作。目标是在 30 秒内判断是否值得打开仓库。</p>
        </div>
      </div>
      ${brief.topItems?.length ? brief.topItems.map(renderProjectCard).join("\n") : `<p class="empty">暂无深读项目。</p>`}
    </section>

    ${renderInspirationSection(brief.inspirationItems)}

    <section class="cta">
      <div>
        <span class="cta-label">Subscription</span>
        <h2>想持续收到 AI Builder Radar？</h2>
        <p>每期从 GitHub 项目里筛出值得 AI 应用开发者点开、学习或复刻的机会，并给出风险和下一步动作。</p>
      </div>
      <div class="cta-actions">
        ${ctaUrl ? `<a class="button" href="${escapeAttribute(ctaUrl)}">${escapeHtml(ctaLabel)}</a>` : `<span class="button muted">${escapeHtml(ctaLabel)}</span>`}
        ${fullReportUrl ? `<a class="secondary" href="${escapeAttribute(fullReportUrl)}">查看完整版报告</a>` : ""}
      </div>
    </section>
  </main>
</body>
</html>
`;
}

function renderStats(stats = {}) {
  const items = [
    ["候选项目", stats["候选项目"]],
    ["分析成功", stats["分析成功"]],
    ["最终推荐", stats["最终推荐"]],
    ["质量警告", stats["质量警告"]]
  ].filter(([, value]) => value !== undefined && value !== "");

  if (!items.length) return "";
  return `<div class="metric-strip">${items
    .map(
      ([label, value]) => `<div class="metric-card">
        <strong>${escapeHtml(value)}</strong>
        <span>${escapeHtml(label)}</span>
      </div>`
    )
    .join("")}</div>`;
}

function renderProjectCard(item, index) {
  const whyValues = [...(item.reasons || []).slice(0, 2), ...(item.attentionSignals || []).slice(0, 1)];
  const riskLabel = firstLabel(item.risks, "风险待复核");
  const costLabel = firstLabel(item.learningCost, "成本待复核");

  return `<article class="project-card">
    <header class="project-top">
      <div class="rank-block">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <small>Top Pick</small>
      </div>
      <div class="project-title">
        <h3>${renderProjectLink(item)}</h3>
        ${item.summary ? `<p class="summary">${escapeHtml(item.summary)}</p>` : ""}
      </div>
      <div class="project-meta">
        ${item.recommendationLevel ? `<span class="meta-pill action">${escapeHtml(item.recommendationLevel)}</span>` : ""}
        <span class="meta-pill cost">${escapeHtml(costLabel)}</span>
        <span class="meta-pill risk">${escapeHtml(riskLabel)}</span>
      </div>
    </header>

    ${item.clickVerdict ? `<div class="verdict-panel"><span>是否值得点开</span><p>${escapeHtml(item.clickVerdict)}</p></div>` : ""}

    <div class="narrative-grid">
      ${item.contextExplanation ? `<section class="narrative-block"><h4>项目背景与使用场景</h4><p>${escapeHtml(item.contextExplanation)}</p></section>` : ""}
      ${item.useCaseExample ? `<section class="narrative-block example"><h4>简单例子</h4><p>${escapeHtml(item.useCaseExample)}</p></section>` : ""}
    </div>

    <div class="decision-grid">
      ${renderDecisionBlock("为什么值得看", whyValues, "action")}
      ${renderDecisionBlock("能学习到什么", item.learningTakeaways, "opportunity")}
      ${renderDecisionBlock("最大风险", item.risks, "risk")}
      ${renderDecisionBlock("下一步动作", item.actions, "action")}
    </div>

    ${item.projectIdea ? `<div class="idea-panel"><span>可转化项目想法</span><p>${escapeHtml(item.projectIdea)}</p></div>` : ""}
  </article>`;
}

function renderInspirationSection(items = []) {
  if (!items.length) return "";
  return `<section class="section">
    <div class="section-header">
      <span class="section-index">02</span>
      <div>
        <h2>可转化为项目灵感</h2>
        <p class="section-note">适合后续做 demo、内容选题或产品假设的小机会。</p>
      </div>
    </div>
    <div class="inspiration-grid">
      ${items.map(renderInspirationCard).join("\n")}
    </div>
  </section>`;
}

function renderInspirationCard(item) {
  return `<article class="mini-card">
    <h3>${renderProjectLink(item)}</h3>
    ${item.projectIdea ? `<p>${escapeHtml(item.projectIdea)}</p>` : item.clickVerdict ? `<p>${escapeHtml(item.clickVerdict)}</p>` : ""}
    ${renderDecisionBlock("风险", item.risks, "risk compact")}
  </article>`;
}

function renderProjectLink(item) {
  const url = safePlainUrl(item.link || "");
  const name = escapeHtml(item.title || "未知项目");
  return url ? `<a href="${escapeAttribute(url)}">${name}</a>` : name;
}

function renderDecisionBlock(title, values = [], tone = "") {
  const items = (values || []).filter(Boolean).slice(0, 3);
  if (!items.length) return "";
  return `<section class="decision-cell ${escapeAttribute(tone)}">
    <h4>${escapeHtml(title)}</h4>
    <ul>${items.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>
  </section>`;
}

function firstLabel(values = [], fallback = "") {
  const first = (values || []).find(Boolean);
  if (!first) return fallback;
  return String(first).split(/[；:：]/)[0].trim() || fallback;
}

function briefCss() {
  return `
:root {
  color-scheme: light;
  --text-primary: #172033;
  --text-secondary: #667085;
  --text-tertiary: #8a94a6;
  --surface: #ffffff;
  --surface-soft: #f6f8fb;
  --surface-tint: #eef4ff;
  --border: #d9e1ec;
  --border-strong: #bac6d5;
  --accent-action: #2563eb;
  --accent-opportunity: #0f766e;
  --accent-risk: #b45309;
  --accent-ink: #111827;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", Arial, sans-serif;
  color: var(--text-primary);
  background: var(--surface-soft);
}
a { color: var(--accent-action); text-decoration: none; }
a:hover { text-decoration: underline; }
.page { max-width: 1080px; margin: 0 auto; padding: 28px; }
.issue-header, .project-card, .mini-card, .cta {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.issue-header {
  padding: 30px;
  border-top: 6px solid var(--accent-action);
}
.brand-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border);
}
.brand-name {
  font-size: 15px;
  font-weight: 800;
  color: var(--accent-ink);
}
.brand-divider { color: var(--text-tertiary); }
.product-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--accent-action);
}
.issue-date {
  margin-left: auto;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;
}
.hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(300px, .95fr);
  gap: 22px;
  align-items: stretch;
  margin-top: 24px;
}
.kicker, .cta-label {
  margin: 0 0 8px;
  color: var(--accent-opportunity);
  font-size: 13px;
  font-weight: 800;
}
h1 {
  margin: 0;
  font-size: 34px;
  line-height: 1.2;
  letter-spacing: 0;
}
h2 {
  margin: 0;
  font-size: 24px;
  line-height: 1.3;
  letter-spacing: 0;
}
h3 {
  margin: 0;
  font-size: 20px;
  line-height: 1.35;
  letter-spacing: 0;
}
h4 {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.35;
  color: var(--text-secondary);
  letter-spacing: 0;
}
.profile {
  margin: 14px 0 0;
  color: var(--text-secondary);
  line-height: 1.75;
}
.insight-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 18px;
  border: 1px solid var(--border);
  border-left: 4px solid var(--accent-action);
  border-radius: 8px;
  background: var(--surface-tint);
}
.insight-panel span {
  color: var(--accent-action);
  font-size: 13px;
  font-weight: 800;
}
.insight-panel p {
  margin: 8px 0 0;
  color: var(--text-primary);
  font-size: 17px;
  line-height: 1.72;
  font-weight: 700;
}
.metric-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 24px;
}
.metric-card {
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-soft);
}
.metric-card strong {
  display: block;
  font-size: 26px;
  line-height: 1.1;
  color: var(--accent-ink);
}
.metric-card span {
  display: block;
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 13px;
}
.section { margin: 28px 0; }
.section-header {
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 14px;
  align-items: start;
  margin-bottom: 14px;
}
.section-index {
  display: inline-grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  color: var(--text-secondary);
  font-weight: 800;
}
.section-note {
  margin: 6px 0 0;
  color: var(--text-secondary);
  line-height: 1.7;
}
.project-card {
  margin: 16px 0;
  padding: 22px;
}
.project-top {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) auto;
  gap: 16px;
  align-items: start;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border);
}
.rank-block {
  display: grid;
  gap: 4px;
  color: var(--text-secondary);
}
.rank-block span {
  font-size: 28px;
  line-height: 1;
  font-weight: 900;
  color: var(--accent-action);
}
.rank-block small {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}
.summary {
  margin: 8px 0 0;
  color: var(--text-secondary);
  line-height: 1.65;
}
.project-meta {
  display: flex;
  max-width: 260px;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.meta-pill {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  background: var(--surface-soft);
  font-size: 12px;
  font-weight: 800;
}
.meta-pill.action { color: var(--accent-action); border-color: #bfd3ff; background: #f3f7ff; }
.meta-pill.cost { color: var(--accent-opportunity); border-color: #b7e2d7; background: #f0fdfa; }
.meta-pill.risk { color: var(--accent-risk); border-color: #f0d2a4; background: #fff8ed; }
.verdict-panel {
  margin-top: 18px;
  padding: 14px 16px;
  border-left: 4px solid var(--accent-action);
  background: #f7faff;
}
.verdict-panel span, .idea-panel span {
  display: block;
  margin-bottom: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 800;
}
.verdict-panel p, .idea-panel p {
  margin: 0;
  color: var(--text-primary);
  line-height: 1.72;
  font-weight: 700;
}
.narrative-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}
.narrative-block {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-soft);
}
.narrative-block.example {
  border-left: 4px solid var(--accent-opportunity);
  background: #f7fcfa;
}
.narrative-block p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.72;
}
.decision-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}
.decision-cell {
  padding: 14px;
  border-top: 3px solid var(--border-strong);
  background: var(--surface);
}
.decision-cell.action { border-top-color: var(--accent-action); }
.decision-cell.opportunity { border-top-color: var(--accent-opportunity); }
.decision-cell.risk { border-top-color: var(--accent-risk); }
.decision-cell ul {
  margin: 0;
  padding-left: 18px;
}
.decision-cell li {
  margin: 7px 0;
  color: var(--text-secondary);
  line-height: 1.65;
}
.decision-cell.risk li { color: #8a4b0f; }
.idea-panel {
  margin-top: 14px;
  padding: 15px 16px;
  border: 1px solid #b7e2d7;
  border-left: 4px solid var(--accent-opportunity);
  border-radius: 8px;
  background: #f0fdfa;
}
.inspiration-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.mini-card {
  padding: 18px;
}
.mini-card p {
  color: var(--text-secondary);
  line-height: 1.7;
}
.mini-card .decision-cell {
  margin-top: 12px;
  padding: 0;
  background: transparent;
}
.cta {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  padding: 24px;
  margin: 30px 0;
  border-left: 4px solid var(--accent-action);
}
.cta h2 { margin-top: 0; }
.cta p {
  margin: 8px 0 0;
  color: var(--text-secondary);
  line-height: 1.75;
}
.cta-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.button, .secondary {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  padding: 0 16px;
  border-radius: 8px;
  font-weight: 800;
}
.button {
  background: var(--accent-action);
  color: #fff;
}
.button:hover { text-decoration: none; }
.button.muted {
  background: #e9eef6;
  color: var(--text-primary);
}
.secondary {
  border: 1px solid var(--border);
  color: var(--accent-action);
  background: var(--surface);
}
.empty { color: var(--text-secondary); }
@media (max-width: 820px) {
  .page { padding: 14px; }
  .issue-header, .project-card, .mini-card, .cta { padding: 18px; }
  .hero-grid, .metric-strip, .narrative-grid, .decision-grid, .inspiration-grid, .cta {
    grid-template-columns: 1fr;
  }
  .issue-date { margin-left: 0; width: 100%; }
  h1 { font-size: 28px; }
  h2 { font-size: 21px; }
  .project-top {
    grid-template-columns: 46px minmax(0, 1fr);
  }
  .project-meta {
    grid-column: 1 / -1;
    max-width: none;
    justify-content: flex-start;
  }
  .cta-actions { justify-content: flex-start; }
}
@media print {
  body { background: #fff; }
  .page { max-width: none; padding: 0; }
  .issue-header, .project-card, .mini-card, .cta {
    box-shadow: none;
    break-inside: avoid;
  }
  .project-card { page-break-inside: avoid; }
  a { color: #111827; text-decoration: underline; }
}
`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
