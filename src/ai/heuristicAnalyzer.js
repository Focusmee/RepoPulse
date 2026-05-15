import { daysBetween } from "../shared/date.js";
import { average, clamp, logScore, round } from "../shared/math.js";
import { countMatches, extractHeadings, firstUsefulParagraph, includesAny, truncate } from "../shared/text.js";
import { calculateProfileMatchScore, explainProfileFit } from "../scorers/profileMatch.js";
import { LEARNING_DIMENSIONS } from "./prompt.js";

const DOC_TERMS = ["installation", "usage", "quickstart", "getting started", "example", "examples", "docs", "api"];
const ARCH_TERMS = ["architecture", "design", "core", "engine", "runtime", "module", "plugin", "provider"];
const PRACTICAL_TERMS = ["cli", "sdk", "api", "dashboard", "server", "template", "starter", "workflow", "automation", "agent"];
const TREND_TERMS = ["llm", "agent", "rag", "ai", "workflow", "kubernetes", "database", "observability", "compiler"];

export function analyzeRepoHeuristically({ repo, trend, documents, profile }) {
  const readme = documents?.readme_text || "";
  const headings = extractHeadings(readme);
  const text = [repo.description, repo.language, ...(repo.topics || []), readme.slice(0, 6000)].join(" ");
  const readmeLength = readme.length;

  const documentationQuality = clamp(
    (readmeLength > 500 ? 25 : readmeLength / 20) +
      countMatches(readme, DOC_TERMS) * 8 +
      Math.min(20, headings.length * 3)
  );
  const codeStructureReadability = clamp(35 + countMatches(text, ARCH_TERMS) * 10 + countMatches(text, ["examples", "tests"]) * 8);
  const technicalRepresentativeness = clamp(logScore(repo.stars, 20_000) * 0.45 + countMatches(text, TREND_TERMS) * 12 + (repo.topics?.length || 0) * 2);
  const practicalTransferValue = clamp(30 + countMatches(text, PRACTICAL_TERMS) * 10 + (repo.license ? 12 : 0));
  const maturitySignal = clamp(logScore(repo.stars, 50_000) * 0.35 + logScore(repo.forks, 10_000) * 0.25 + recencyQuality(repo.pushed_at) * 0.25 + (repo.license ? 15 : 0));
  const profileGoalFit = calculateProfileMatchScore(repo, profile, readme.slice(0, 1500));
  const aiOverallJudgement = average([
    documentationQuality,
    codeStructureReadability,
    technicalRepresentativeness,
    practicalTransferValue,
    maturitySignal,
    profileGoalFit
  ]);

  const learningScore = round(
    0.2 * documentationQuality +
      0.2 * codeStructureReadability +
      0.15 * technicalRepresentativeness +
      0.15 * practicalTransferValue +
      0.1 * maturitySignal +
      0.1 * profileGoalFit +
      0.1 * aiOverallJudgement
  );

  const summary = buildSummary(repo, readme);
  const confidence = confidenceScore(repo, readme, documents);
  const breakdown = buildBreakdown({
    documentationQuality,
    codeStructureReadability,
    technicalRepresentativeness,
    practicalTransferValue,
    maturitySignal,
    profileGoalFit,
    aiOverallJudgement,
    repo,
    readme,
    headings
  });
  const reasons = buildReasons({
    repo,
    trend,
    profile,
    documentationQuality,
    codeStructureReadability,
    practicalTransferValue,
    profileGoalFit,
    headings
  });

  return {
    schema_version: "1.0",
    summary,
    problem_solved: firstUsefulParagraph(readme) || repo.description || summary,
    why_it_matters_now: buildWhyItMatters(repo, trend),
    learning_value: {
      score: learningScore,
      level: learningScore >= 75 ? "high" : learningScore >= 50 ? "medium" : "low",
      breakdown,
      reasons
    },
    trend_explanation: {
      score_hint: trend.trend_score >= 75 ? "高" : trend.trend_score >= 45 ? "中" : "低",
      signals: buildTrendSignals(trend)
    },
    audience: buildAudience(repo, profile),
    profile_fit: {
      score: Math.round(profileGoalFit),
      why_for_this_user: explainProfileFit(repo, profile, profileGoalFit)
    },
    recommended_reading_path: buildReadingPath(readme, headings),
    project_idea: buildProjectIdea(repo, profile),
    risks: buildRisks(repo, readme, confidence),
    confidence: {
      score: confidence,
      reason: confidence >= 75 ? "README 和元数据较充分" : "上下文有限，建议人工复核关键判断"
    },
    scoring_breakdown: {
      documentation_quality: round(documentationQuality, 1),
      code_structure_readability: round(codeStructureReadability, 1),
      technical_representativeness: round(technicalRepresentativeness, 1),
      practical_transfer_value: round(practicalTransferValue, 1),
      maturity_signal: round(maturitySignal, 1),
      profile_goal_fit: round(profileGoalFit, 1),
      ai_overall_judgement: round(aiOverallJudgement, 1)
    }
  };
}

function buildBreakdown(input) {
  const scores = {
    documentation_quality: input.documentationQuality,
    code_structure_readability: input.codeStructureReadability,
    technical_representativeness: input.technicalRepresentativeness,
    practical_transfer_value: input.practicalTransferValue,
    maturity_signal: input.maturitySignal,
    profile_goal_fit: input.profileGoalFit,
    overall_judgement: input.aiOverallJudgement
  };

  const details = {
    documentation_quality: {
      reason: "根据 README 长度、章节、quickstart、usage、examples、docs 等信号评分。",
      evidence: input.headings.length
        ? `README 章节：${input.headings.slice(0, 5).join("、")}`
        : `README 长度约 ${input.readme.length} 字符`
    },
    code_structure_readability: {
      reason: "根据 architecture、core、engine、runtime、examples、tests 等工程结构线索评分。",
      evidence: "来自 README、仓库描述和 topics 的结构化关键词"
    },
    technical_representativeness: {
      reason: "根据 stars、topics 和技术趋势关键词判断是否代表某类技术方向。",
      evidence: `stars=${input.repo.stars || 0}，topics=${(input.repo.topics || []).slice(0, 6).join(", ") || "无"}`
    },
    practical_transfer_value: {
      reason: "根据 CLI、SDK、API、dashboard、workflow、agent、template 等实战迁移信号评分。",
      evidence: `license=${input.repo.license || "未标明"}，language=${input.repo.language || "未知"}`
    },
    maturity_signal: {
      reason: "根据 stars、forks、license 和最近更新时间估算成熟度。",
      evidence: `stars=${input.repo.stars || 0}，forks=${input.repo.forks || 0}，pushed_at=${input.repo.pushed_at || "未知"}`
    },
    profile_goal_fit: {
      reason: "根据用户偏好语言、关注 topic、学习目标和排除项评分。",
      evidence: `项目语言=${input.repo.language || "未知"}，项目 topics=${(input.repo.topics || []).slice(0, 6).join(", ") || "无"}`
    },
    overall_judgement: {
      reason: "综合所有分项后的兜底判断，避免单一指标主导结果。",
      evidence: "综合文档、结构、技术代表性、迁移价值、成熟度和画像匹配"
    }
  };

  return LEARNING_DIMENSIONS.map((dimension) => ({
    id: dimension.id,
    label: dimension.label,
    weight: dimension.weight,
    score: round(scores[dimension.id] || 0, 1),
    reason: details[dimension.id]?.reason || dimension.question,
    evidence: details[dimension.id]?.evidence || "本地规则计算"
  }));
}

function buildSummary(repo, readme) {
  const description = repo.description || firstUsefulParagraph(readme);
  if (!description) return `${repo.full_name} 是一个 ${repo.language || "开源"} 项目`;
  return truncate(description.replace(/\.$/, ""), 60);
}

function buildWhyItMatters(repo, trend) {
  const signals = buildTrendSignals(trend);
  if (signals.length > 0) {
    return `近期有${signals.join("、")}等信号，适合作为趋势观察和学习候选。`;
  }
  if (repo.stars > 5000) return "已有较高社区关注度，可作为成熟项目样本阅读。";
  return "项目进入候选池，适合结合 README 和个人目标进一步判断。";
}

function buildTrendSignals(trend) {
  const signals = [];
  if (trend.stars_1d !== null && trend.stars_1d > 0) signals.push(`1 日增星 ${trend.stars_1d}`);
  if (trend.stars_7d !== null && trend.stars_7d > 0) signals.push(`7 日增星 ${trend.stars_7d}`);
  if (trend.forks_7d !== null && trend.forks_7d > 0) signals.push(`7 日 fork 增长 ${trend.forks_7d}`);
  if (trend.source_tags?.some((tag) => tag.startsWith("github_trending"))) signals.push("进入 GitHub Trending");
  return signals.slice(0, 4);
}

function buildReasons(input) {
  const reasons = [];
  if (input.documentationQuality >= 60) {
    reasons.push({
      reason: "文档信息量较足，适合快速建立项目认知。",
      evidence: input.headings.length ? `README 包含 ${input.headings.slice(0, 3).join("、")} 等章节` : "README 长度和示例信号较充分"
    });
  }
  if (input.codeStructureReadability >= 55) {
    reasons.push({
      reason: "项目具备可读的工程或模块化线索。",
      evidence: "README 或 topics 中出现 architecture/core/examples 等结构信号"
    });
  }
  if (input.practicalTransferValue >= 55) {
    reasons.push({
      reason: "有较强实战迁移价值，适合作为 demo、工具或简历项目参考。",
      evidence: `项目描述、topics 或 README 命中实用型关键词；license=${input.repo.license || "未标明"}`
    });
  }
  if (input.profileGoalFit >= 45) {
    reasons.push({
      reason: "和当前用户画像存在明确交集。",
      evidence: `语言=${input.repo.language || "未知"}，topics=${(input.repo.topics || []).slice(0, 5).join(", ") || "无"}`
    });
  }
  if (reasons.length === 0) {
    reasons.push({
      reason: "项目具备基础开源信号，但学习价值需要进一步人工确认。",
      evidence: `stars=${input.repo.stars || 0}, forks=${input.repo.forks || 0}`
    });
  }
  return reasons.slice(0, 4);
}

function buildAudience(repo, profile) {
  const audience = new Set();
  if (repo.language) audience.add(`${repo.language} 开发者`);
  if (profile.role) audience.add(profile.role);
  for (const topic of (repo.topics || []).slice(0, 2)) audience.add(`${topic} 学习者`);
  return Array.from(audience).slice(0, 4);
}

function buildReadingPath(readme, headings) {
  const steps = [
    { step: 1, action: "先读 README 的项目定位、安装和快速开始部分", goal: "确认项目解决的问题和运行方式" }
  ];
  if (headings.some((heading) => /example|usage|quick/i.test(heading))) {
    steps.push({ step: 2, action: "阅读 examples / usage 相关章节", goal: "找到最短可运行路径" });
  } else {
    steps.push({ step: 2, action: "搜索 README 中的 usage、example、demo 关键词", goal: "确认是否有可复现样例" });
  }
  if (includesAny(readme, ARCH_TERMS)) {
    steps.push({ step: 3, action: "阅读 architecture / core / design 相关章节", goal: "理解模块边界和核心流程" });
  } else {
    steps.push({ step: 3, action: "进入仓库目录查看 src、examples、docs 或 packages", goal: "从目录结构判断源码阅读入口" });
  }
  steps.push({ step: 4, action: "查看 issues、releases 和最近提交", goal: "判断维护状态和 API 稳定性" });
  return steps;
}

function buildProjectIdea(repo, profile) {
  if (profile.learning_goals.some((goal) => goal.includes("应用") || goal.includes("项目"))) {
    return `围绕 ${repo.full_name} 做一个小型复刻或场景化封装，并写清楚解决的问题、架构和取舍。`;
  }
  if (profile.learning_goals.some((goal) => goal.includes("找工作"))) {
    return `把 ${repo.full_name} 的核心设计整理成源码阅读笔记，再做一个同技术栈的最小 demo。`;
  }
  return `把项目的核心思路整理成学习卡片，和同类项目做一次对比。`;
}

function buildRisks(repo, readme, confidence) {
  const risks = [];
  if (!readme || readme.length < 500) risks.push({ risk: "README 信息偏少，AI 判断依据有限。", severity: "medium" });
  if (!repo.license) risks.push({ risk: "license 未明确，二次开发或商用前需要确认。", severity: "medium" });
  if (daysBetween(repo.pushed_at) > 180) risks.push({ risk: "近期维护活跃度偏低。", severity: "medium" });
  if (repo.archived) risks.push({ risk: "仓库已归档，不适合作为活跃技术方向投入。", severity: "high" });
  if (confidence < 60) risks.push({ risk: "分析置信度偏低，需要人工打开仓库复核。", severity: "medium" });
  return risks.length ? risks.slice(0, 4) : [{ risk: "暂未发现明显风险，但仍建议检查 issue 和 release 节奏。", severity: "low" }];
}

function confidenceScore(repo, readme) {
  return clamp(
    35 +
      (repo.description ? 10 : 0) +
      (repo.topics?.length ? 10 : 0) +
      (readme.length > 500 ? 20 : 0) +
      (readme.length > 2000 ? 15 : 0) +
      (repo.license ? 10 : 0)
  );
}

function recencyQuality(pushedAt) {
  const days = daysBetween(pushedAt);
  if (days <= 7) return 100;
  if (days <= 30) return 80;
  if (days <= 90) return 55;
  if (days <= 180) return 35;
  return 15;
}
