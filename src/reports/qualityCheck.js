const SUSPICIOUS_TOKEN_RULES = [
  { token: "iii", pattern: /\biii\b/i },
  { token: "READM", pattern: /\bREADM\b/ },
  { token: "undefined", pattern: /\bundefined\b/i },
  { token: "null", pattern: /\bnull\b/i },
  { token: "NaN", pattern: /\bNaN\b/ },
  { token: "�", pattern: /�/ }
];

const VAGUE_EVIDENCE_PATTERNS = [
  /^readme$/i,
  /^metadata$/i,
  /^github metadata$/i,
  /^topics$/i,
  /^文档$/,
  /^README\s*(中)?(提到|显示|说明)?[。.]?$/i,
  /^项目描述[。.]?$/,
  /^仓库信息[。.]?$/
];

const OVERSELLING_PATTERNS = [
  /完美匹配/g,
  /极完备/g,
  /一应俱全/g,
  /最强/g,
  /必看/g,
  /无可替代/g
];

const VAGUE_RISK_PATTERNS = [
  /^项目较新[。.]?$/,
  /^学习成本高[。.]?$/,
  /^存在不确定性[。.]?$/,
  /^需要进一步观察[。.]?$/,
  /^风险较高[。.]?$/
];

export function checkReportQuality({ ranked }) {
  const items = ranked?.items || [];
  const warnings = [];

  const strongItems = items.filter((item) => item.recommendation_level === "强推荐");
  if (strongItems.length > 3) {
    warnings.push(warning("high", "too_many_strong_recommendations", "", `强推荐数量为 ${strongItems.length}，超过上限 3。`));
  }

  const deepReadItems = items.filter((item) => item.category === "今日最值得深读");
  if (deepReadItems.length > 3) {
    warnings.push(warning("medium", "too_many_deep_read_items", "", `今日最值得深读数量为 ${deepReadItems.length}，建议控制在 3 个以内。`));
  }

  const categorySet = new Set(items.map((item) => item.category).filter(Boolean));
  if (items.length >= 5 && categorySet.size === 1) {
    warnings.push(warning("medium", "single_category_report", "", `Top ${items.length} 全部进入「${items[0].category}」，分层不够克制。`));
  }

  for (const item of items) {
    checkEvidence(item, warnings);
    checkRisks(item, warnings);
    checkSuspiciousText(item, warnings);
    checkOversellingText(item, warnings);
  }

  return {
    warning_count: warnings.length,
    warnings
  };
}

function checkRisks(item, warnings) {
  const risks = item.analysis?.risks || [];
  if (item.recommendation_level === "强推荐" && risks.some((risk) => risk.severity === "high")) {
    warnings.push(warning("high", "overstrong_recommendation", item.repo?.full_name, "强推荐项目包含 high 风险，应降级或补充明确收益说明。"));
  }

  for (const [index, risk] of risks.entries()) {
    const text = String(risk.risk || "").trim();
    if (isVagueRisk(text)) {
      warnings.push(warning("medium", "vague_risk", item.repo?.full_name, `风险 ${index + 1} 过于空泛：${text || "空"}`));
    }
  }
}

function checkEvidence(item, warnings) {
  const reasons = item.analysis?.learning_value?.reasons || [];
  for (const [index, reason] of reasons.entries()) {
    const evidence = String(reason.evidence || "").trim();
    if (isVagueEvidence(evidence)) {
      warnings.push(
        warning(
          "medium",
          "vague_evidence",
          item.repo?.full_name,
          `推荐理由 ${index + 1} 的证据过于空泛：${evidence || "空"}`
        )
      );
    }
  }
}

function checkSuspiciousText(item, warnings) {
  const text = collectItemText(item);
  for (const rule of SUSPICIOUS_TOKEN_RULES) {
    if (rule.pattern.test(text)) {
      warnings.push(
        warning(
          "medium",
          "suspicious_token",
          item.repo?.full_name,
          `分析文本中出现异常 token：${rule.token}`
        )
      );
    }
  }
}

function checkOversellingText(item, warnings) {
  const text = collectItemText(item);
  for (const pattern of OVERSELLING_PATTERNS) {
    const matches = text.match(pattern);
    if (matches?.length) {
      warnings.push(
        warning(
          "low",
          "overselling_language",
          item.repo?.full_name,
          `分析文本中出现偏营销化表达：${matches[0]}`
        )
      );
    }
  }
}

function collectItemText(item) {
  const analysis = item.analysis || {};
  return [
    analysis.summary,
    analysis.problem_solved,
    analysis.why_it_matters_now,
    analysis.profile_fit?.why_for_this_user,
    analysis.project_idea,
    ...(analysis.learning_value?.reasons || []).flatMap((reason) => [reason.reason, reason.evidence]),
    ...(analysis.learning_value?.breakdown || []).flatMap((part) => [part.reason, part.evidence]),
    ...(analysis.recommended_reading_path || []).flatMap((step) => [step.action, step.goal]),
    ...(analysis.risks || []).map((risk) => risk.risk),
    analysis.confidence?.reason
  ]
    .filter(Boolean)
    .join("\n");
}

function isVagueEvidence(evidence) {
  if (evidence.length < 8) return true;
  return VAGUE_EVIDENCE_PATTERNS.some((pattern) => pattern.test(evidence));
}

function isVagueRisk(risk) {
  if (risk.length < 10) return true;
  return VAGUE_RISK_PATTERNS.some((pattern) => pattern.test(risk));
}

function warning(level, type, repo, message) {
  return {
    level,
    type,
    repo: repo || "",
    message
  };
}
