import { round } from "../shared/math.js";
import { escapeMarkdownText, safePlainUrl } from "../shared/markdown.js";
import { estimateLearningCost } from "../scorers/learningCost.js";

export function renderMarkdownReport({ date, profile, ranked, stats }) {
  const sections = groupByCategory(ranked.items);
  const topTopics = summarizeTopics(ranked.items);

  return [
    `# RepoPulse 日报 - ${text(date)}`,
    "",
    `画像：${text(profile.role)}；偏好语言：${joinText(profile.preferred_languages) || "未设置"}；关注方向：${joinText(profile.interested_topics) || "未设置"}`,
    "",
    "## 今日结论",
    "",
    topTopics.length
      ? `今天更值得关注的方向是：${topTopics.join("、")}。推荐优先看学习价值高、和画像匹配强、阅读路径清晰的项目。`
      : "今天候选项目较少，建议检查 GitHub Token、网络或 watchlist 配置。",
    "",
    renderStats(stats),
    "",
    renderSection("今日最值得深读", sections.get("今日最值得深读"), profile),
    renderSection("上升很快，值得观察", sections.get("上升很快，值得观察"), profile),
    renderSection("可转化为项目灵感", sections.get("可转化为项目灵感"), profile),
    renderSection("谨慎关注", sections.get("谨慎关注"), profile),
    renderQualityWarnings(stats.quality_warnings),
    "",
    "## 使用建议",
    "",
    "1. 先从“今日最值得深读”挑 1 到 3 个项目打开 README。",
    "2. 按每个项目的阅读路径走一遍，记录可复用的架构、模块和 API 设计。",
    "3. 对“可转化为项目灵感”的项目，优先做最小 demo 或源码阅读笔记。",
    "4. 对“谨慎关注”的项目，先核查维护状态和文档质量。",
    ""
  ]
    .filter((part) => part !== null && part !== undefined)
    .join("\n");
}

function renderStats(stats) {
  return [
    "## 运行概览",
    "",
    `- 候选项目：${stats.candidate_count}`,
    `- 尝试分析：${stats.analysis_attempted_count ?? stats.analyzed_count}`,
    `- 分析成功：${stats.analyzed_count}`,
    `- 最终推荐：${stats.recommended_count}`,
    `- README 成功率：${stats.readme_success_rate}%`,
    `- 分析成功率：${stats.analysis_success_rate ?? 100}%`,
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

function renderSection(title, items = [], profile) {
  if (!items || items.length === 0) return "";
  return [`## ${title}`, "", ...items.map((item, index) => renderItem(item, index + 1, profile)), ""].join("\n");
}

function renderItem(item, index, profile) {
  const { repo, analysis, scores, trend } = item;
  return [
    `### ${index}. ${text(repo.full_name)}`,
    "",
    `- 一句话定位：${text(analysis.summary)}`,
    `- 是否值得点开：${text(buildClickVerdict(item))}`,
    `- 推荐等级：${text(item.recommendation_level || recommendationLevel(scores.personalized_score))}`,
    renderAnalysisMode(item.analysis_meta),
    `- 项目类型：${text(item.repo_class?.label || "未分类")}；${text(item.repo_class?.reason || "")}`,
    `- 综合分：${scores.personalized_score}；学习价值：${scores.learning_score}；热度：${scores.trend_score}；画像匹配：${scores.profile_match_score}；投入适配：${scores.investment_fit_score ?? "未计算"}`,
    `- 置信度：${round(Number(analysis.confidence?.score || 0), 1)}；${text(analysis.confidence?.reason || "未提供置信度说明")}`,
    ...renderAttentionSignals(repo, trend),
    ...renderRecommendationReasons(analysis),
    ...renderLearningCostEstimate(item, profile),
    ...renderRisks(analysis.risks, item.repo_class),
    ...renderRecommendedActions(analysis.recommended_reading_path),
    ...renderProfileFit(repo, analysis, profile),
    analysis.project_idea ? `- 可转化项目想法：${text(analysis.project_idea)}` : null,
    ...renderFactSources(item),
    ...renderLearningSummary(analysis),
    `- 链接：${safePlainUrl(repo.html_url) || text(repo.html_url)}`,
    ""
  ]
    .filter(Boolean)
    .join("\n");
}

function buildClickVerdict(item) {
  const analysis = item.analysis || {};
  const topReason = analysis.learning_value?.reasons?.[0]?.reason || analysis.why_it_matters_now || analysis.summary || "建议结合 README 再判断";
  const highestRisk = pickHighestRisk(analysis.risks);

  if (item.recommendation_level === "强推荐") return `建议点开深读：${topReason}`;
  if (item.category === "上升很快，值得观察") return `值得点开观察趋势：${analysis.why_it_matters_now || renderTrend(item.trend)}`;
  if (item.category === "可转化为项目灵感") return `适合点开找灵感：${analysis.project_idea || topReason}`;
  if (highestRisk?.severity === "high") return `先谨慎观察：${highestRisk.risk}`;
  return `可以先扫一眼 README：${highestRisk?.risk || topReason}`;
}

function renderAnalysisMode(meta) {
  if (!meta) return null;
  if (meta.provider === "heuristic" && meta.ai_failure_type) {
    const debugText = renderDebugArtifacts(meta.ai_debug_artifacts);
    return `- 分析方式：heuristic 降级（AI 失败类型：${text(meta.ai_failure_type)}；尝试 ${Number(meta.ai_attempts || 1)} 次${debugText}）`;
  }
  if (meta.provider === "heuristic") return "- 分析方式：heuristic";
  if (meta.provider === "openai") return `- 分析方式：openai${meta.model ? `（${text(meta.model)}）` : ""}${meta.source === "cache" ? "；cache" : ""}`;
  return `- 分析方式：${text(meta.provider)}`;
}

function renderDebugArtifacts(paths = []) {
  const values = paths.filter(Boolean);
  if (!values.length) return "";
  return `；debug：${values.map(text).join("、")}`;
}

function renderLearningBreakdown(breakdown = [], limit = 3) {
  if (!breakdown.length) return "暂无明细";
  return breakdown
    .slice(0, limit)
    .map((item) => `${text(item.label)} ${round(Number(item.score || 0), 1)} x${Math.round(Number(item.weight || 0) * 100)}%`)
    .join("；");
}

function renderFactSources(item) {
  const { repo, analysis, document_status: documentStatus } = item;
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
    "- 事实来源：",
    `  - GitHub metadata：stars ${formatNumber(repo.stars)}；forks ${formatNumber(repo.forks)}；open issues ${formatNumber(repo.open_issues)}；最近更新 ${text(repo.pushed_at || "未知")}`,
    `  - README：${text(readmeText)}`,
    `  - release：${text(releaseText)}`,
    `  - topics：${joinText((repo.topics || []).slice(0, 8)) || "未设置"}`,
    `  - license：${text(repo.license || "未声明")}`
  ];
}

function renderAttentionSignals(repo, trend) {
  return [
    "- 为什么值得关注：",
    `  - 趋势信号：${renderTrend(trend)}`,
    `  - 社区信号：stars ${formatNumber(repo.stars)}；forks ${formatNumber(repo.forks)}；open issues ${formatNumber(repo.open_issues)}`,
    `  - 近期活跃：最近更新 ${text(repo.pushed_at || "未知")}`
  ];
}

function renderRecommendationReasons(analysis) {
  const reasons = analysis.learning_value?.reasons || [];
  return [
    "- 推荐理由与证据：",
    ...(reasons.length
      ? reasons.map((reason, index) => `  ${index + 1}. 判断：${text(reason.reason)}；证据：${text(reason.evidence)}`)
      : ["  1. 判断：暂无明确推荐理由；证据：需要人工打开 README 复核"])
  ];
}

function renderLearningSummary(analysis) {
  const breakdown = analysis.learning_value?.breakdown || [];
  const importantDimensions = pickLearningDimensions(breakdown);
  return [
    `- 学习价值摘要：${round(Number(analysis.learning_value?.score || 0), 1)} / ${text(analysis.learning_value?.level || "unknown")}；${renderLearningBreakdown(importantDimensions)}`,
    "- 学习价值明细摘要：",
    ...importantDimensions.map(
      (item) => `  - ${text(item.label)} ${round(Number(item.score || 0), 1)}：${text(item.reason)}；证据：${text(item.evidence)}`
    )
  ];
}

function renderLearningCostEstimate(item, profile = {}) {
  const cost =
    item.analysis?.learning_cost ||
    estimateLearningCost({ repo: item.repo, analysis: item.analysis, profile, repoClass: item.repo_class });
  const prerequisites = (cost.prerequisites || []).filter(Boolean);
  const blockers = (cost.blockers || []).filter(Boolean);
  return [
    "- 学习成本：",
    `  - ${text(cost.level)}；投入适配分 ${round(Number(cost.investment_fit_score || 0), 1)}：${text(cost.estimated_effort)}；${text(cost.why_for_this_user)}`,
    prerequisites.length ? `  - 前置知识：${joinText(prerequisites.slice(0, 4))}` : null,
    blockers.length ? `  - 可能卡点：${joinText(blockers.slice(0, 3))}` : null
  ].filter(Boolean);
}

function renderProfileFit(repo, analysis, profile = {}) {
  const preferredLanguages = new Set((profile.preferred_languages || []).map((language) => String(language).toLowerCase()));
  const interestedTopics = new Set((profile.interested_topics || []).map((topic) => String(topic).toLowerCase()));
  const languageMatch = repo.language && preferredLanguages.has(String(repo.language).toLowerCase()) ? repo.language : "";
  const topicMatches = (repo.topics || []).filter((topic) => interestedTopics.has(String(topic).toLowerCase()));
  const goalText = (profile.learning_goals || []).length ? `；学习目标=${joinText(profile.learning_goals)}` : "";
  return [
    "- 为什么适合当前画像：",
    `  - 匹配说明：${text(analysis.profile_fit?.why_for_this_user || "和当前画像关联一般，建议作为拓展观察。")}`,
    `  - 语言/主题信号：language=${text(repo.language || "未知")}${languageMatch ? "（命中偏好）" : ""}；topics=${joinText(topicMatches.slice(0, 6)) || joinText((repo.topics || []).slice(0, 6)) || "未设置"}${goalText}`
  ];
}

function renderRecommendedActions(path = []) {
  const actions = path.slice(0, 3);
  return [
    "- 推荐动作：",
    ...(actions.length
      ? actions.map((step, index) => `  ${index + 1}. ${text(step.action)}，目标：${text(step.goal)}`)
      : ["  1. 先打开 README 和 examples，目标：确认项目是否值得继续投入"])
  ];
}

function renderRisks(risks = [], repoClass) {
  const classRisk =
    repoClass?.deep_read_eligible === false
      ? [{ severity: "medium", risk: `${repoClass.label} 不默认等同于生产级工程，建议优先作为灵感或复刻素材。` }]
      : [];
  const visibleRisks = [...classRisk, ...risks].slice(0, 3);
  return [
    "- 最大风险：",
    ...(visibleRisks.length
      ? visibleRisks.map((risk) => `  - ${text(risk.severity)}：${text(risk.risk)}`)
      : ["  - low：暂未发现明显风险，仍建议复核 issue、release 和 license。"])
  ];
}

function renderTrend(trend) {
  const parts = [];
  if (trend.stars_1d !== null && trend.stars_1d !== undefined) parts.push(`1 日增星 ${trend.stars_1d}`);
  if (trend.stars_7d !== null && trend.stars_7d !== undefined) parts.push(`7 日增星 ${trend.stars_7d}`);
  if (trend.forks_7d !== null && trend.forks_7d !== undefined) parts.push(`7 日 fork ${trend.forks_7d}`);
  if (trend.source_tags?.length) parts.push(`来源 ${joinText(trend.source_tags.slice(0, 3))}`);
  return parts.length ? parts.join("；") : "暂无历史增量，使用来源和活跃度信号估算";
}

function pickHighestRisk(risks = []) {
  const severityRank = { high: 3, medium: 2, low: 1 };
  return [...risks].sort((a, b) => (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0))[0] || null;
}

function renderQualityWarnings(warnings = []) {
  if (!warnings.length) return "";
  return [
    "## 质量警告",
    "",
    ...warnings.slice(0, 20).map((warning) => {
      const repo = warning.repo ? `${text(warning.repo)}：` : "";
      return `- ${text(warning.level)} / ${text(warning.type)}：${repo}${text(warning.message)}`;
    }),
    warnings.length > 20 ? `- 其余 ${warnings.length - 20} 条质量警告已省略。` : null,
    ""
  ]
    .filter(Boolean)
    .join("\n");
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
    .map(([topic, count]) => `${text(topic)}(${round(count)})`);
}

function text(value) {
  return escapeMarkdownText(value);
}

function joinText(values = []) {
  return values.map(text).filter(Boolean).join("、");
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
