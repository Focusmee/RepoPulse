import { clamp } from "../shared/math.js";
import { includesAny } from "../shared/text.js";

const VALID_COST_LEVELS = new Set(["low", "medium", "high"]);
const COMPLEXITY_TERMS = [
  "kubernetes",
  "docker",
  "gpu",
  "cuda",
  "distributed",
  "microservice",
  "monorepo",
  "workspace",
  "orchestration",
  "platform",
  "self-hosted"
];
const QUICKSTART_TERMS = ["quickstart", "getting started", "install", "usage", "example", "examples", "demo"];
const EXTERNAL_DEPENDENCY_PATTERN = /外部服务|第三方 API|token|API key|OAuth|隐私|用户数据|云服务|账号授权|平台策略/i;

export function estimateLearningCost({ repo = {}, analysis = {}, profile = {}, documents = {}, repoClass = null } = {}) {
  const readme = documents?.readme_text || "";
  const repoText = buildRepoText({ repo, analysis, readme });
  const prerequisites = new Set();
  const blockers = new Set();
  let costPoints = 0;
  let fitBonus = 0;

  const knownMatches = matchTerms(repoText, profile.known_stack);
  const weakMatches = matchTerms(repoText, profile.weak_areas);
  if (knownMatches.length) fitBonus += Math.min(12, knownMatches.length * 4);
  if (weakMatches.length) {
    costPoints += Math.min(3, weakMatches.length);
    for (const item of weakMatches.slice(0, 3)) prerequisites.add(item);
    blockers.add(`命中薄弱方向：${weakMatches.slice(0, 3).join("、")}`);
  }

  const language = String(repo.language || "").trim();
  if (language) {
    const languageKnown = includesNormalized(profile.known_stack, language) || includesNormalized(profile.preferred_languages, language);
    if (languageKnown) {
      fitBonus += 8;
    } else {
      costPoints += 1;
      prerequisites.add(language);
    }
  }

  const hasQuickstart = includesAny(readme, QUICKSTART_TERMS);
  if (hasQuickstart) fitBonus += 8;
  if (!readme || readme.length < 800) {
    costPoints += 1;
    blockers.add("README 信息偏少");
  }

  const isComplexProject =
    includesAny(repoText, COMPLEXITY_TERMS) || repoClass?.type === "framework_or_platform" || Number(repo.open_issues || 0) > 300;
  if (isComplexProject) {
    costPoints += 1;
    blockers.add("项目规模、部署或模块边界较复杂");
  }

  if (profile.skill_level === "junior" && isComplexProject) {
    costPoints += 2;
    blockers.add("当前技术水平与项目复杂度存在落差");
  } else if (profile.skill_level === "senior" && isComplexProject) {
    fitBonus += 6;
  }

  if (profile.time_budget === "quick-scan" && isComplexProject) {
    costPoints += 2;
    blockers.add("当前时间预算偏短，不适合直接深读复杂项目");
  } else if (profile.time_budget === "deep-study") {
    fitBonus += 6;
  }

  if (profile.preferred_project_size === "small" && isComplexProject) {
    costPoints += 1;
    blockers.add("项目规模可能超出当前偏好的 small demo 范围");
  } else if (profile.preferred_project_size === "large" && isComplexProject) {
    fitBonus += 4;
  }

  if ((analysis.risks || []).some((risk) => risk.severity === "high")) {
    costPoints += 2;
    blockers.add("存在 high 风险，投入前需要先复核");
  }
  if ((analysis.risks || []).some((risk) => EXTERNAL_DEPENDENCY_PATTERN.test(risk.risk))) {
    costPoints += 1;
    blockers.add("外部服务、账号授权或敏感配置可能影响复现");
  }

  if ((profile.goal_priority || []).includes("ship_demo") && hasQuickstart) fitBonus += 8;
  if ((profile.goal_priority || []).includes("resume_project") && Number(analysis.learning_value?.score || 0) >= 75) fitBonus += 6;
  if ((profile.goal_priority || []).includes("follow_trend") && analysis.trend_explanation?.score_hint === "高") fitBonus += 4;

  const investmentFitScore = Math.round(clamp(82 + fitBonus - costPoints * 13));
  const level = levelFromInvestmentFit(investmentFitScore);
  return {
    level,
    investment_fit_score: investmentFitScore,
    estimated_effort: effortFor({ level, timeBudget: profile.time_budget }),
    prerequisites: Array.from(prerequisites).slice(0, 5),
    blockers: Array.from(blockers).slice(0, 5),
    why_for_this_user: explainLearningCost({ level, investmentFitScore, knownMatches, weakMatches, hasQuickstart, isComplexProject, profile })
  };
}

export function normalizeLearningCost(value = {}, fallback = defaultLearningCost()) {
  const source = value && typeof value === "object" ? value : {};
  const normalizedLevel = normalizeLevel(source.level, fallback.level);
  return {
    level: normalizedLevel,
    investment_fit_score: clampInteger(
      source.investment_fit_score ?? source.investmentFitScore ?? source.score ?? fallback.investment_fit_score
    ),
    estimated_effort: String(source.estimated_effort || source.estimatedEffort || fallback.estimated_effort || ""),
    prerequisites: normalizeStringArray(source.prerequisites, fallback.prerequisites),
    blockers: normalizeStringArray(source.blockers, fallback.blockers),
    why_for_this_user: String(source.why_for_this_user || source.whyForThisUser || fallback.why_for_this_user || "")
  };
}

export function defaultLearningCost() {
  return {
    level: "medium",
    investment_fit_score: 50,
    estimated_effort: "需要先用 30 分钟到半天验证 README、examples 和依赖",
    prerequisites: [],
    blockers: ["学习成本信息不足"],
    why_for_this_user: "缺少足够画像或项目证据，先按中等投入成本处理"
  };
}

function buildRepoText({ repo, analysis, readme }) {
  return [
    repo.full_name,
    repo.description,
    repo.language,
    ...(repo.topics || []),
    analysis.summary,
    analysis.problem_solved,
    analysis.project_idea,
    ...(analysis.risks || []).map((risk) => risk.risk),
    readme.slice(0, 6000)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchTerms(text, terms = []) {
  const lower = String(text || "").toLowerCase();
  return (terms || []).filter((term) => lower.includes(String(term).toLowerCase()));
}

function includesNormalized(values = [], target) {
  const normalizedTarget = String(target || "").toLowerCase();
  return (values || []).some((value) => String(value || "").toLowerCase() === normalizedTarget);
}

function levelFromInvestmentFit(score) {
  if (score >= 70) return "low";
  if (score >= 45) return "medium";
  return "high";
}

function effortFor({ level, timeBudget }) {
  if (level === "low") return timeBudget === "quick-scan" ? "30 分钟内判断价值，半天内可尝试跑通 demo" : "半天内可跑通 demo 并定位核心入口";
  if (level === "medium") return timeBudget === "deep-study" ? "适合预留 1-2 天深入拆解" : "适合周末半天到一天验证";
  return timeBudget === "deep-study" ? "建议拆成 1-2 天的小目标逐步深入" : "建议先观察，至少预留 1-2 天拆解";
}

function explainLearningCost({ level, investmentFitScore, knownMatches, weakMatches, hasQuickstart, isComplexProject, profile }) {
  const reasons = [];
  if (knownMatches.length) reasons.push(`已掌握 ${knownMatches.slice(0, 3).join("、")} 可降低上手成本`);
  if (weakMatches.length) reasons.push(`命中薄弱方向 ${weakMatches.slice(0, 3).join("、")} 需要先补齐`);
  if (hasQuickstart) reasons.push("README 存在 quickstart/examples/demo 等低成本入口");
  if (isComplexProject) reasons.push("项目规模、部署或模块边界偏复杂");
  if (profile.time_budget) reasons.push(`当前时间预算为 ${profile.time_budget}`);
  return `学习成本为 ${level}，投入适配分 ${investmentFitScore}。${reasons.join("；") || "证据有限，建议先小步验证。"}。`;
}

function normalizeLevel(value, fallback = "medium") {
  const normalized = String(value || "").toLowerCase();
  if (VALID_COST_LEVELS.has(normalized)) return normalized;
  return VALID_COST_LEVELS.has(fallback) ? fallback : "medium";
}

function normalizeStringArray(value, fallback = []) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 8);
  if (value) return [String(value).trim()].filter(Boolean);
  return (fallback || []).map(String).map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

function clampInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}
