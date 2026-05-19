import { escapeMarkdownText, safePlainUrl } from "../shared/markdown.js";
import { buildFullReportModel } from "./models/buildFullReportModel.js";

export function renderMarkdownReport(input) {
  const report = input?.kind === "full" ? input : buildFullReportModel(input || {});

  return [
    `# ${text(report.title)}`,
    "",
    text(report.profileLine),
    "",
    "## 今日结论",
    "",
    text(report.conclusion),
    "",
    renderStats(report.stats),
    "",
    ...report.sections.map(renderSection),
    renderQualityWarnings(report.qualityWarnings),
    "",
    "## 使用建议",
    "",
    ...report.usageTips.map((tip, index) => `${index + 1}. ${text(tip)}`),
    ""
  ]
    .filter((part) => part !== null && part !== undefined)
    .join("\n");
}

function renderStats(stats = {}) {
  return [
    "## 运行概览",
    "",
    `- 候选项目：${stats.candidate_count}`,
    `- 尝试分析：${stats.analysis_attempted_count}`,
    `- 分析成功：${stats.analyzed_count}`,
    `- 最终推荐：${stats.recommended_count}`,
    `- README 成功率：${stats.readme_success_rate}%`,
    `- 分析成功率：${stats.analysis_success_rate}%`,
    `- AI/规则分析：${text(stats.ai_provider_summary)}`,
    `- AI 成功数：${Number(stats.ai_success_count || 0)}`,
    `- heuristic 降级数：${Number(stats.heuristic_fallback_count || 0)}`,
    `- AI 失败类型分布：${text(stats.ai_failure_type_summary || "none")}`,
    `- 质量警告：${Number(stats.quality_warning_count || 0)}`,
    stats.analysis_failed_count ? `- 单项目失败：${stats.analysis_failed_count}` : null,
    ""
  ]
    .filter(Boolean)
    .join("\n");
}

function renderSection(section) {
  if (!section.items?.length) return "";
  return [`## ${text(section.title)}`, "", ...section.items.map(renderItem), ""].join("\n");
}

function renderItem(item) {
  return [
    `### ${item.index}. ${text(item.title)}`,
    "",
    `- 一句话定位：${text(item.summary)}`,
    `- 项目背景与使用场景：${text(item.contextExplanation)}`,
    `- 简单例子：${text(item.useCaseExample)}`,
    ...renderList("能学习到什么", item.learningTakeaways),
    `- 是否值得点开：${text(item.clickVerdict)}`,
    `- 推荐等级：${text(item.recommendationLevel)}`,
    item.analysisMode ? `- 分析方式：${text(item.analysisMode)}` : null,
    `- 项目类型：${text(item.repoClass.label)}；${text(item.repoClass.reason)}`,
    `- ${text(item.scoreLine)}`,
    `- ${text(item.confidenceLine)}`,
    ...renderList("为什么值得关注", item.attentionSignals),
    ...renderRecommendationReasons(item.recommendationReasons),
    ...renderLearningCost(item.learningCost),
    ...renderRisks(item.risks),
    ...renderRecommendedActions(item.recommendedActions),
    ...renderList("为什么适合当前画像", item.profileFit),
    item.projectIdea ? `- 可转化项目想法：${text(item.projectIdea)}` : null,
    ...renderList("事实来源", item.factSources),
    ...renderLearningSummary(item.learningSummary),
    `- 链接：${safePlainUrl(item.link) || text(item.link)}`,
    ""
  ]
    .filter(Boolean)
    .join("\n");
}

function renderRecommendationReasons(reasons = []) {
  return [
    "- 推荐理由与证据：",
    ...(reasons.length
      ? reasons.map((reason, index) => `  ${index + 1}. ${text(reason.text || `判断：${reason.reason}；证据：${reason.evidence}`)}`)
      : ["  1. 判断：暂无明确推荐理由；证据：需要人工打开 README 复核"])
  ];
}

function renderLearningCost(cost = {}) {
  return [
    "- 学习成本：",
    `  - ${text(cost.summary || "未知成本；需要打开 README 复核")}`,
    cost.prerequisites?.length ? `  - 前置知识：${joinText(cost.prerequisites.slice(0, 4))}` : null,
    cost.blockers?.length ? `  - 可能卡点：${joinText(cost.blockers.slice(0, 3))}` : null
  ].filter(Boolean);
}

function renderRisks(risks = []) {
  return [
    "- 最大风险：",
    ...(risks.length ? risks.map((risk) => `  - ${text(risk.text || `${risk.severityLabel}：${risk.risk}`)}`) : ["  - 低风险：暂未发现明显风险，仍建议复核 issue、release 和 license。"])
  ];
}

function renderRecommendedActions(actions = []) {
  return [
    "- 推荐动作：",
    ...(actions.length ? actions.map((step, index) => `  ${index + 1}. ${text(step.text)}`) : ["  1. 先打开 README 和 examples，目标：确认项目是否值得继续投入"])
  ];
}

function renderLearningSummary(summary = {}) {
  return [
    `- 学习价值摘要：${text(summary.headline || "暂无明细")}`,
    "- 学习价值明细摘要：",
    ...(summary.details || []).map((item) => `  - ${text(item)}`)
  ];
}

function renderQualityWarnings(warnings = []) {
  if (!warnings.length) return "";
  return [
    "## 质量警告",
    "",
    ...warnings.slice(0, 20).map((warning) => {
      const repo = warning.repo ? `${text(warning.repo)}：` : "";
      return `- ${text(warning.levelLabel || warning.level)} / ${text(warning.type)}：${repo}${text(warning.message)}`;
    }),
    warnings.length > 20 ? `- 其余 ${warnings.length - 20} 条质量警告已省略。` : null,
    ""
  ]
    .filter(Boolean)
    .join("\n");
}

function renderList(title, values = []) {
  const items = values.filter(Boolean);
  if (!items.length) return [];
  return [`- ${title}：`, ...items.map((item) => `  - ${text(item)}`)];
}

function text(value) {
  return escapeMarkdownText(value);
}

function joinText(values = []) {
  return values.map(text).filter(Boolean).join("、");
}
