import { round } from "../shared/math.js";
import { escapeMarkdownText, safePlainUrl } from "../shared/markdown.js";

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
    renderSection("今日最值得深读", sections.get("今日最值得深读")),
    renderSection("上升很快，值得观察", sections.get("上升很快，值得观察")),
    renderSection("可转化为项目灵感", sections.get("可转化为项目灵感")),
    renderSection("谨慎关注", sections.get("谨慎关注")),
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
    stats.analysis_failed_count ? `- 单项目失败：${stats.analysis_failed_count}` : null,
    ""
  ]
    .filter(Boolean)
    .join("\n");
}

function renderSection(title, items = []) {
  if (!items || items.length === 0) return "";
  return [`## ${title}`, "", ...items.map((item, index) => renderItem(item, index + 1)), ""].join("\n");
}

function renderItem(item, index) {
  const { repo, analysis, scores, trend } = item;
  return [
    `### ${index}. ${text(repo.full_name)}`,
    "",
    `- 一句话定位：${text(analysis.summary)}`,
    `- 推荐等级：${recommendationLevel(scores.personalized_score)}`,
    `- 综合分：${scores.personalized_score}；学习价值：${scores.learning_score}；热度：${scores.trend_score}；画像匹配：${scores.profile_match_score}`,
    `- 学习价值明细：${renderLearningBreakdown(analysis.learning_value?.breakdown)}`,
    `- 热度信号：${renderTrend(trend)}`,
    `- 为什么适合你：${text(analysis.profile_fit?.why_for_this_user || "和当前画像关联一般，建议作为拓展观察。")}`,
    `- 推荐理由：${analysis.learning_value.reasons.map((reason) => `${text(reason.reason)}；${text(reason.evidence)}`).join("；")}`,
    `- 推荐阅读路径：${analysis.recommended_reading_path.map((step) => `${step.step}. ${text(step.action)}，目标：${text(step.goal)}`).join("；")}`,
    analysis.project_idea ? `- 可转化项目想法：${text(analysis.project_idea)}` : null,
    `- 风险：${analysis.risks.map((risk) => `${text(risk.risk)}；${text(risk.severity)}`).join("；")}`,
    `- 链接：${safePlainUrl(repo.html_url) || text(repo.html_url)}`,
    ""
  ]
    .filter(Boolean)
    .join("\n");
}

function renderLearningBreakdown(breakdown = []) {
  if (!breakdown.length) return "暂无明细";
  return breakdown
    .map((item) => `${text(item.label)} ${round(Number(item.score || 0), 1)} x${Math.round(Number(item.weight || 0) * 100)}%`)
    .join("；");
}

function renderTrend(trend) {
  const parts = [];
  if (trend.stars_1d !== null && trend.stars_1d !== undefined) parts.push(`1 日增星 ${trend.stars_1d}`);
  if (trend.stars_7d !== null && trend.stars_7d !== undefined) parts.push(`7 日增星 ${trend.stars_7d}`);
  if (trend.forks_7d !== null && trend.forks_7d !== undefined) parts.push(`7 日 fork ${trend.forks_7d}`);
  if (trend.source_tags?.length) parts.push(`来源 ${joinText(trend.source_tags.slice(0, 3))}`);
  return parts.length ? parts.join("；") : "暂无历史增量，使用来源和活跃度信号估算";
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
