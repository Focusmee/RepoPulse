export function renderPersonaResultHtml(personaResult = {}) {
  const strategies = (personaResult.recommendationStrategy || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const summary = personaResult.profileSummary || {};

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(personaResult.headline || "SBTI AI 开发者画像")}</title>
  <style>
    body { margin: 0; font-family: Arial, "Microsoft YaHei", sans-serif; color: #182026; background: #f6f7f2; }
    main { max-width: 760px; margin: 0 auto; padding: 48px 20px; }
    header { border-bottom: 2px solid #182026; padding-bottom: 24px; }
    h1 { font-size: 40px; line-height: 1.15; margin: 0 0 12px; }
    h2 { font-size: 22px; margin: 32px 0 12px; }
    p, li { font-size: 16px; line-height: 1.75; }
    .sub { font-size: 20px; margin: 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 20px 0; }
    .cell { border: 1px solid #c8d0c6; padding: 12px; background: #fff; }
    .label { display: block; font-size: 12px; color: #58635b; margin-bottom: 6px; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(personaResult.headline || "")}</h1>
      <p class="sub">${escapeHtml(personaResult.subheadline || "")}</p>
    </header>
    <section>
      <h2>认真画像</h2>
      <p>${escapeHtml(personaResult.seriousDescription || "")}</p>
      <div class="grid">
        <div class="cell"><span class="label">行业 / 场景</span>${escapeHtml(summary.industry || "未设置")}</div>
        <div class="cell"><span class="label">当前目标</span>${escapeHtml(summary.goal || "未设置")}</div>
        <div class="cell"><span class="label">时间预算</span>${escapeHtml(summary.timeBudget || "未设置")}</div>
        <div class="cell"><span class="label">当前卡点</span>${escapeHtml(summary.painPoint || "未设置")}</div>
      </div>
    </section>
    <section>
      <h2>推荐策略</h2>
      <ul>${strategies}</ul>
    </section>
    <section>
      <h2>日报开场</h2>
      <p>${escapeHtml(personaResult.dailyReportIntro || "")}</p>
    </section>
  </main>
</body>
</html>
`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
