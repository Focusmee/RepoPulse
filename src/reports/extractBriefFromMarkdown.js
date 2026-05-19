const DEFAULT_TOP_LIMIT = 3;
const DEFAULT_INSPIRATION_LIMIT = 2;

export function extractBriefFromMarkdown(markdown, options = {}) {
  const topLimit = Number(options.topLimit || DEFAULT_TOP_LIMIT);
  const inspirationLimit = Number(options.inspirationLimit || DEFAULT_INSPIRATION_LIMIT);
  const text = String(markdown || "").replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  const title = firstMatch(lines, /^#\s+(.+)$/) || "RepoPulse 精华版";
  const date = firstMatch([title], /(\d{4}-\d{2}-\d{2})/) || "";
  const profileLine = lines.find((line) => line.startsWith("画像：")) || "";
  const conclusion = compactParagraph(sectionLines(text, "今日结论"));
  const stats = parseStats(sectionLines(text, "运行概览"));
  const deepReadItems = parseProjectSection(sectionLines(text, "今日最值得深读"));
  const inspirationItems = parseProjectSection(sectionLines(text, "可转化为项目灵感"));
  const warnings = [];

  for (const item of [...deepReadItems, ...inspirationItems]) {
    if (!item.title) warnings.push("项目缺少标题");
    if (!item.link) warnings.push(`${item.title || "未知项目"} 缺少链接`);
  }

  return {
    title,
    date,
    profileLine,
    conclusion,
    stats,
    topItems: deepReadItems.slice(0, Math.max(0, topLimit)),
    inspirationItems: inspirationItems.slice(0, Math.max(0, inspirationLimit)),
    warnings: Array.from(new Set(warnings))
  };
}

function sectionLines(markdown, title) {
  const pattern = new RegExp(`^##\\s+${escapeRegExp(title)}\\s*$`, "m");
  const match = pattern.exec(markdown);
  if (!match) return [];
  const start = match.index + match[0].length;
  const rest = markdown.slice(start).replace(/^\n/, "");
  const next = rest.search(/^##\s+/m);
  const body = next >= 0 ? rest.slice(0, next) : rest;
  return body.split("\n");
}

function parseStats(lines) {
  const stats = {};
  for (const line of lines) {
    const match = /^-\s*([^：:]+)[：:]\s*(.+)$/.exec(line.trim());
    if (match) stats[match[1].trim()] = match[2].trim();
  }
  return stats;
}

function parseProjectSection(lines) {
  const items = [];
  let current = null;
  let currentField = "";

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/g, "");
    const heading = /^###\s+\d+\.\s+(.+)$/.exec(line);
    if (heading) {
      if (current) items.push(finalizeProject(current));
      current = {
        title: heading[1].trim(),
        fields: {}
      };
      currentField = "";
      continue;
    }

    if (!current) continue;
    const field = /^-\s*([^：:]+)[：:]\s*(.*)$/.exec(line);
    if (field) {
      currentField = field[1].trim();
      if (!current.fields[currentField]) current.fields[currentField] = [];
      if (field[2].trim()) current.fields[currentField].push(field[2].trim());
      continue;
    }

    if (currentField && /^\s+/.test(line)) {
      const value = line.trim();
      if (value) current.fields[currentField].push(cleanNestedListMarker(value));
    }
  }

  if (current) items.push(finalizeProject(current));
  return items;
}

function finalizeProject(project) {
  const fields = project.fields || {};
  return {
    title: project.title,
    summary: firstValue(fields["一句话定位"]),
    contextExplanation: firstValue(fields["项目背景与使用场景"]),
    useCaseExample: firstValue(fields["简单例子"]),
    learningTakeaways: listValue(fields["能学习到什么"]).slice(0, 3),
    clickVerdict: firstValue(fields["是否值得点开"]),
    recommendationLevel: firstValue(fields["推荐等级"]),
    scores: firstValue(fields["综合分"]),
    attentionSignals: listValue(fields["为什么值得关注"]),
    reasons: listValue(fields["推荐理由与证据"]).slice(0, 2),
    learningCost: listValue(fields["学习成本"]).slice(0, 2),
    risks: listValue(fields["最大风险"]).slice(0, 2),
    actions: listValue(fields["推荐动作"]).slice(0, 2),
    profileFit: listValue(fields["为什么适合当前画像"]).slice(0, 1),
    projectIdea: firstValue(fields["可转化项目想法"]),
    link: firstValue(fields["链接"])
  };
}

function compactParagraph(lines) {
  return lines
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("-"))
    .join(" ")
    .trim();
}

function cleanNestedListMarker(value) {
  return value.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "").trim();
}

function firstValue(values = []) {
  return listValue(values)[0] || "";
}

function listValue(values = []) {
  return (values || []).map((value) => String(value || "").trim()).filter(Boolean);
}

function firstMatch(lines, pattern) {
  for (const line of lines) {
    const match = pattern.exec(line);
    if (match) return match[1] || match[0];
  }
  return "";
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
