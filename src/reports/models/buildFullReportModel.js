import { round } from "../../shared/math.js";
import { safePlainUrl } from "../../shared/markdown.js";
import { normalizeWhitespace, truncate } from "../../shared/text.js";
import { estimateLearningCost } from "../../scorers/learningCost.js";
import {
  formatLearningCostLevel,
  formatLevel,
  formatQualityWarningLevel,
  formatRiskSeverity
} from "./displayLabels.js";

export const REPORT_SECTION_TITLES = ["今日最值得深读", "上升很快，值得观察", "可转化为项目灵感", "谨慎关注"];

export function buildFullReportModel({ date, profile = {}, ranked = {}, stats = {} }) {
  const items = (ranked.items || []).map((item, index) => buildReportItem(item, index + 1, profile));
  const sectionsByTitle = groupByCategory(items);
  const topTopics = summarizeTopics(items);

  return {
    kind: "full",
    title: `RepoPulse 日报 - ${date}`,
    date,
    profile,
    profileLine: buildProfileLine(profile),
    conclusion: topTopics.length
      ? `今天更值得关注的方向是：${topTopics.join("、")}。推荐优先看学习价值高、和画像匹配强、阅读路径清晰的项目。`
      : "今天候选项目较少，建议检查 GitHub Token、网络或 watchlist 配置。",
    stats: normalizeStats(stats),
    sections: REPORT_SECTION_TITLES.map((title) => ({
      title,
      items: sectionsByTitle.get(title) || []
    })),
    qualityWarnings: normalizeQualityWarnings(stats.quality_warnings),
    usageTips: [
      "先从“今日最值得深读”挑 1 到 3 个项目打开 README。",
      "按每个项目的阅读路径走一遍，记录可复用的架构、模块和 API 设计。",
      "对“可转化为项目灵感”的项目，优先做最小 demo 或源码阅读笔记。",
      "对“谨慎关注”的项目，先核查维护状态和文档质量。"
    ]
  };
}

function buildProfileLine(profile = {}) {
  const persona = profile.persona_code && profile.persona_name ? `；人格：${profile.persona_code} / ${profile.persona_name}` : "";
  const style = profile.report_explanation_style ? `；解释风格：${profile.report_explanation_style}` : "";
  return `画像：${profile.role || "未设置"}${persona}；偏好语言：${joinPlain(profile.preferred_languages) || "未设置"}；关注方向：${
    joinPlain(profile.interested_topics) || "未设置"
  }${style}`;
}

export function buildReportItem(item, index, profile = {}) {
  const repo = item.repo || {};
  const analysis = item.analysis || {};
  const scores = item.scores || {};
  const learningCost =
    analysis.learning_cost || estimateLearningCost({ repo, analysis, profile, repoClass: item.repo_class });
  const importantDimensions = pickLearningDimensions(analysis.learning_value?.breakdown || []);

  return {
    index,
    category: normalizeCategory(item.category),
    title: repo.full_name || "未知项目",
    link: safePlainUrl(repo.html_url) || String(repo.html_url || ""),
    repo,
    trend: item.trend || {},
    scores,
    analysis,
    analysisMeta: item.analysis_meta,
    repoClass: {
      label: item.repo_class?.label || "未分类",
      reason: item.repo_class?.reason || ""
    },
    summary: analysis.summary || repo.description || "",
    clickVerdict: buildClickVerdict(item),
    recommendationLevel: item.recommendation_level || recommendationLevel(scores.personalized_score),
    analysisMode: buildAnalysisMode(item.analysis_meta),
    scoreLine: `综合分：${scores.personalized_score}；学习价值：${scores.learning_score}；热度：${scores.trend_score}；画像匹配：${scores.profile_match_score}；投入适配：${
      scores.investment_fit_score ?? "未计算"
    }`,
    confidenceLine: `置信度：${round(Number(analysis.confidence?.score || 0), 1)}；${analysis.confidence?.reason || "未提供置信度说明"}`,
    contextExplanation: buildContextExplanation(item, profile),
    useCaseExample: buildUseCaseExample(item, profile),
    learningTakeaways: buildLearningTakeaways(item, profile),
    attentionSignals: buildAttentionSignals(repo, item.trend || {}),
    recommendationReasons: buildRecommendationReasons(analysis),
    learningCost: buildLearningCost(learningCost),
    risks: buildRisks(analysis.risks, item.repo_class),
    recommendedActions: buildRecommendedActions(analysis.recommended_reading_path),
    profileFit: buildProfileFit(repo, analysis, profile),
    projectIdea: analysis.project_idea || "",
    factSources: buildFactSources(item),
    learningSummary: {
      headline: `${round(Number(analysis.learning_value?.score || 0), 1)} / ${formatLevel(
        analysis.learning_value?.level || "unknown"
      )}；${renderLearningBreakdown(importantDimensions)}`,
      details: importantDimensions.map(
        (dimension) => `${dimension.label} ${round(Number(dimension.score || 0), 1)}：${dimension.reason}；证据：${dimension.evidence}`
      )
    },
    sourceScan: {
      status: item.source_scan_status || "not_run",
      summary: item.source_scan_summary || ""
    }
  };
}

function normalizeStats(stats = {}) {
  return {
    ...stats,
    candidate_count: stats.candidate_count,
    analysis_attempted_count: stats.analysis_attempted_count ?? stats.analyzed_count,
    analyzed_count: stats.analyzed_count,
    recommended_count: stats.recommended_count,
    readme_success_rate: stats.readme_success_rate,
    analysis_success_rate: stats.analysis_success_rate ?? 100,
    ai_provider_summary: stats.ai_provider_summary,
    ai_success_count: Number(stats.ai_success_count || 0),
    heuristic_fallback_count: Number(stats.heuristic_fallback_count || 0),
    ai_failure_type_summary: stats.ai_failure_type_summary || "none",
    quality_warning_count: Number(stats.quality_warning_count || 0),
    analysis_failed_count: stats.analysis_failed_count || 0
  };
}

function normalizeQualityWarnings(warnings = []) {
  return (warnings || []).map((warning) => ({
    ...warning,
    levelLabel: formatQualityWarningLevel(warning.level)
  }));
}

function buildContextExplanation(item, profile = {}) {
  const analysis = item.analysis || {};
  const repo = item.repo || {};
  if (hasText(analysis.context_explanation)) return truncate(analysis.context_explanation, 180);

  const problem = analysis.problem_solved || analysis.summary || repo.description || `${repo.full_name || "这个项目"} 的具体用途需要结合 README 继续判断`;
  const scenario =
    analysis.why_it_matters_now ||
    analysis.profile_fit?.why_for_this_user ||
    `可以作为 ${repo.language || "开源项目"} 工程实现、API 设计或 demo 封装的参考样本。`;
  const audience = profile.role ? `对${profile.role}来说，` : "";
  return truncate(`${audience}${sentence(problem)}${scenario}`, 180);
}

function buildUseCaseExample(item) {
  const analysis = item.analysis || {};
  const repo = item.repo || {};
  if (hasText(analysis.use_case_example)) return truncate(analysis.use_case_example, 160);

  if (analysis.project_idea) {
    return truncate(`例如，先把它改造成“${analysis.project_idea}”，用一个最小 demo 验证核心流程，再决定是否深入读源码。`, 160);
  }

  const target = analysis.summary || repo.description || repo.full_name || "这个项目";
  return truncate(`例如，把它当成“${target}”的参考实现，先跑通 README 中的最小流程，再替换成自己的数据或业务入口。`, 160);
}

function buildLearningTakeaways(item, profile = {}) {
  const analysis = item.analysis || {};
  const repo = item.repo || {};
  const provided = normalizeList(analysis.learning_takeaways).slice(0, 4);
  if (provided.length) return provided;

  const takeaways = [];
  const breakdown = analysis.learning_value?.breakdown || [];
  const strongDimensions = [...breakdown].sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 2);
  for (const dimension of strongDimensions) {
    if (dimension.label) takeaways.push(`学习它在“${dimension.label}”上的做法：${dimension.reason || "结合 README 和示例拆解实现思路"}`);
  }
  if (repo.language) takeaways.push(`学习 ${repo.language} 项目的工程组织、依赖使用和接口表达方式。`);
  if (analysis.project_idea) takeaways.push(`学习如何把开源项目转化成自己的 demo 或产品假设：${analysis.project_idea}`);
  if (!takeaways.length && profile.learning_goals?.length) takeaways.push(`围绕学习目标“${profile.learning_goals[0]}”判断它是否值得复刻。`);
  return takeaways.slice(0, 4);
}

function buildAttentionSignals(repo, trend) {
  return [
    `趋势信号：${renderTrend(trend)}`,
    `社区信号：stars ${formatNumber(repo.stars)}；forks ${formatNumber(repo.forks)}；open issues ${formatNumber(repo.open_issues)}`,
    `近期活跃：最近更新 ${repo.pushed_at || "未知"}`
  ];
}

function buildRecommendationReasons(analysis = {}) {
  const reasons = analysis.learning_value?.reasons || [];
  if (!reasons.length) {
    return [{ reason: "暂无明确推荐理由", evidence: "需要人工打开 README 复核", text: "判断：暂无明确推荐理由；证据：需要人工打开 README 复核" }];
  }
  return reasons.map((reason) => ({
    reason: reason.reason || "",
    evidence: reason.evidence || "",
    text: `判断：${reason.reason || ""}；证据：${reason.evidence || ""}`
  }));
}

function buildLearningCost(cost = {}) {
  const prerequisites = normalizeList(cost.prerequisites);
  const blockers = normalizeList(cost.blockers);
  return {
    ...cost,
    levelLabel: formatLearningCostLevel(cost.level),
    summary: `${formatLearningCostLevel(cost.level)}；投入适配分 ${round(Number(cost.investment_fit_score || 0), 1)}：${
      cost.estimated_effort || "未估算"
    }；${cost.why_for_this_user || "未提供画像解释"}`,
    prerequisites,
    blockers
  };
}

function buildRisks(risks = [], repoClass) {
  const classRisk =
    repoClass?.deep_read_eligible === false
      ? [{ severity: "medium", risk: `${repoClass.label} 不默认等同于生产级工程，建议优先作为灵感或复刻素材。` }]
      : [];
  const visibleRisks = [...classRisk, ...(risks || [])].slice(0, 3);
  const normalized = visibleRisks.length
    ? visibleRisks
    : [{ severity: "low", risk: "暂未发现明显风险，仍建议复核 issue、release 和 license。" }];

  return normalized.map((risk) => ({
    severity: risk.severity || "medium",
    severityLabel: formatRiskSeverity(risk.severity),
    risk: risk.risk || "",
    text: `${formatRiskSeverity(risk.severity)}：${risk.risk || ""}`
  }));
}

function buildRecommendedActions(path = []) {
  const actions = (path || []).slice(0, 3);
  const visibleActions = actions.length
    ? actions
    : [{ step: 1, action: "先打开 README 和 examples", goal: "确认项目是否值得继续投入" }];

  return visibleActions.map((step, index) => ({
    step: Number(step.step || index + 1),
    action: step.action || "",
    goal: step.goal || "",
    text: `${step.action || ""}，目标：${step.goal || ""}`
  }));
}

function buildProfileFit(repo, analysis = {}, profile = {}) {
  const preferredLanguages = new Set((profile.preferred_languages || []).map((language) => String(language).toLowerCase()));
  const interestedTopics = new Set((profile.interested_topics || []).map((topic) => String(topic).toLowerCase()));
  const languageMatch = repo.language && preferredLanguages.has(String(repo.language).toLowerCase()) ? repo.language : "";
  const topicMatches = (repo.topics || []).filter((topic) => interestedTopics.has(String(topic).toLowerCase()));
  const goalText = (profile.learning_goals || []).length ? `；学习目标=${joinPlain(profile.learning_goals)}` : "";

  return [
    `匹配说明：${analysis.profile_fit?.why_for_this_user || "和当前画像关联一般，建议作为拓展观察。"}`,
    `语言/主题信号：language=${repo.language || "未知"}${languageMatch ? "（命中偏好）" : ""}；topics=${
      joinPlain(topicMatches.slice(0, 6)) || joinPlain((repo.topics || []).slice(0, 6)) || "未设置"
    }${goalText}`
  ];
}

function buildFactSources(item) {
  const { repo = {}, analysis = {}, document_status: documentStatus } = item;
  const evidenceCounts = countEvidenceSources(analysis);
  const readmeText =
    documentStatus?.readme_status === "ok"
      ? `已抓取 ${documentStatus.readme_chars || 0} 字符；证据引用 ${evidenceCounts.readme} 次`
      : `状态 ${documentStatus?.readme_status || "unknown"}；证据引用 ${evidenceCounts.readme} 次`;
  const releaseText =
    documentStatus?.release_status === "present"
      ? `已抓取 ${documentStatus.release_chars || 0} 字符；证据引用 ${evidenceCounts.release} 次`
      : `未获取到最新 release 摘要；证据引用 ${evidenceCounts.release} 次`;

  return [
    `GitHub metadata：stars ${formatNumber(repo.stars)}；forks ${formatNumber(repo.forks)}；open issues ${formatNumber(repo.open_issues)}；最近更新 ${
      repo.pushed_at || "未知"
    }`,
    `README：${readmeText}`,
    `release：${releaseText}`,
    `topics：${joinPlain((repo.topics || []).slice(0, 8)) || "未设置"}`,
    `license：${repo.license || "未声明"}`
  ];
}

function buildAnalysisMode(meta) {
  if (!meta) return "";
  if (meta.provider === "heuristic" && meta.ai_failure_type) {
    const debugText = renderDebugArtifacts(meta.ai_debug_artifacts);
    return `heuristic 降级（AI 失败类型：${meta.ai_failure_type}；尝试 ${Number(meta.ai_attempts || 1)} 次${debugText}）`;
  }
  if (meta.provider === "heuristic") return "heuristic";
  if (meta.provider === "openai") return `openai${meta.model ? `（${meta.model}）` : ""}${meta.source === "cache" ? "；cache" : ""}`;
  return String(meta.provider || "");
}

function renderDebugArtifacts(paths = []) {
  const values = paths.filter(Boolean);
  if (!values.length) return "";
  return `；debug：${values.join("、")}`;
}

function buildClickVerdict(item) {
  const analysis = item.analysis || {};
  const category = normalizeCategory(item.category);
  const topReason = analysis.learning_value?.reasons?.[0]?.reason || analysis.why_it_matters_now || analysis.summary || "建议结合 README 再判断";
  const highestRisk = pickHighestRisk(analysis.risks);

  if (item.recommendation_level === "强推荐") return `建议点开深读：${topReason}`;
  if (category === "上升很快，值得观察") return `值得点开观察趋势：${analysis.why_it_matters_now || renderTrend(item.trend || {})}`;
  if (category === "可转化为项目灵感") return `适合点开找灵感：${analysis.project_idea || topReason}`;
  if (highestRisk?.severity === "high") return `先谨慎观察：${highestRisk.risk}`;
  return `可以先扫一眼 README：${highestRisk?.risk || topReason}`;
}

function renderLearningBreakdown(breakdown = [], limit = 3) {
  if (!breakdown.length) return "暂无明细";
  return breakdown
    .slice(0, limit)
    .map((item) => `${item.label} ${round(Number(item.score || 0), 1)} x${Math.round(Number(item.weight || 0) * 100)}%`)
    .join("；");
}

function renderTrend(trend = {}) {
  const parts = [];
  if (trend.stars_1d !== null && trend.stars_1d !== undefined) parts.push(`1 日增星 ${trend.stars_1d}`);
  if (trend.stars_7d !== null && trend.stars_7d !== undefined) parts.push(`7 日增星 ${trend.stars_7d}`);
  if (trend.forks_7d !== null && trend.forks_7d !== undefined) parts.push(`7 日 fork ${trend.forks_7d}`);
  if (trend.source_tags?.length) parts.push(`来源 ${joinPlain(trend.source_tags.slice(0, 3))}`);
  return parts.length ? parts.join("；") : "暂无历史增量，使用来源和活跃度信号估算";
}

function pickHighestRisk(risks = []) {
  const severityRank = { high: 3, medium: 2, low: 1 };
  return [...(risks || [])].sort((a, b) => (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0))[0] || null;
}

function recommendationLevel(score) {
  if (score >= 75) return "强推荐";
  if (score >= 55) return "值得观察";
  return "谨慎关注";
}

function groupByCategory(items) {
  const map = new Map();
  for (const item of items) {
    const category = normalizeCategory(item.category);
    if (!map.has(category)) map.set(category, []);
    map.get(category).push(item);
  }
  return map;
}

function normalizeCategory(category) {
  const textValue = String(category || "");
  if (textValue.includes("深读")) return "今日最值得深读";
  if (textValue.includes("上升")) return "上升很快，值得观察";
  if (textValue.includes("项目") || textValue.includes("灵感")) return "可转化为项目灵感";
  return "谨慎关注";
}

function summarizeTopics(items) {
  const counts = new Map();
  for (const item of items) {
    for (const topic of item.repo.topics || []) {
      counts.set(topic, (counts.get(topic) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic, count]) => `${topic}(${round(count)})`);
}

function pickLearningDimensions(breakdown = []) {
  const preferred = ["documentation_quality", "code_structure_readability", "technical_representativeness", "practical_transfer_value"];
  const byId = new Map(breakdown.map((item) => [item.id, item]));
  const selected = preferred.map((id) => byId.get(id)).filter(Boolean);
  return selected.length ? selected : breakdown.slice(0, 4);
}

function countEvidenceSources(analysis = {}) {
  const evidenceText = [
    ...(analysis.learning_value?.reasons || []).map((reason) => reason.evidence),
    ...(analysis.learning_value?.breakdown || []).map((item) => item.evidence),
    analysis.confidence?.reason
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  return {
    readme: countMatches(evidenceText, /readme/g),
    release: countMatches(evidenceText, /release|changelog|版本|发布/g)
  };
}

function countMatches(textValue, pattern) {
  return textValue.match(pattern)?.length || 0;
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "未知";
  return String(round(number));
}

function joinPlain(values = []) {
  return values.map((value) => String(value || "").trim()).filter(Boolean).join("、");
}

function normalizeList(values = []) {
  return (Array.isArray(values) ? values : [values]).map((value) => normalizeWhitespace(value)).filter(Boolean);
}

function sentence(value) {
  const text = normalizeWhitespace(value);
  if (!text) return "";
  return /[。.!?？]$/.test(text) ? text : `${text}。`;
}

function hasText(value) {
  return normalizeWhitespace(value).length > 0;
}
