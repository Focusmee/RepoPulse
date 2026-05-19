import { buildFullReportModel } from "./buildFullReportModel.js";

const DEFAULT_TOP_LIMIT = 3;
const DEFAULT_INSPIRATION_LIMIT = 2;

export function buildBriefReportModel(input, options = {}) {
  const fullReport = input?.kind === "full" ? input : buildFullReportModel(input || {});
  const topLimit = Number(options.topLimit || DEFAULT_TOP_LIMIT);
  const inspirationLimit = Number(options.inspirationLimit || DEFAULT_INSPIRATION_LIMIT);
  const deepReadItems = sectionItems(fullReport, "今日最值得深读");
  const inspirationItems = sectionItems(fullReport, "可转化为项目灵感");

  return {
    kind: "brief",
    title: fullReport.title?.replace("日报", "日报精华版") || "RepoPulse 精华版",
    date: fullReport.date || "",
    profileLine: fullReport.profileLine || "",
    conclusion: fullReport.conclusion || "",
    stats: {
      候选项目: valueText(fullReport.stats?.candidate_count),
      分析成功: valueText(fullReport.stats?.analyzed_count),
      最终推荐: valueText(fullReport.stats?.recommended_count),
      质量警告: valueText(fullReport.stats?.quality_warning_count)
    },
    topItems: deepReadItems.slice(0, Math.max(0, topLimit)).map(toBriefItem),
    inspirationItems: inspirationItems.slice(0, Math.max(0, inspirationLimit)).map(toBriefItem),
    warnings: []
  };
}

function sectionItems(fullReport, title) {
  return fullReport.sections?.find((section) => section.title === title)?.items || [];
}

function toBriefItem(item) {
  return {
    title: item.title,
    link: item.link,
    summary: item.summary,
    recommendationLevel: item.recommendationLevel,
    clickVerdict: item.clickVerdict,
    contextExplanation: item.contextExplanation,
    useCaseExample: item.useCaseExample,
    learningTakeaways: (item.learningTakeaways || []).slice(0, 3),
    attentionSignals: (item.attentionSignals || []).slice(0, 2),
    reasons: (item.recommendationReasons || []).map((reason) => reason.text || reason.reason).filter(Boolean).slice(0, 2),
    learningCost: [item.learningCost?.summary, ...(item.learningCost?.blockers || []).slice(0, 1).map((blocker) => `可能卡点：${blocker}`)].filter(Boolean),
    risks: (item.risks || []).map((risk) => risk.text || risk.risk).filter(Boolean).slice(0, 2),
    actions: (item.recommendedActions || []).map((action) => action.text).filter(Boolean).slice(0, 2),
    profileFit: (item.profileFit || []).slice(0, 1),
    projectIdea: item.projectIdea || ""
  };
}

function valueText(value) {
  if (value === undefined || value === null || value === "") return "";
  return String(value);
}
