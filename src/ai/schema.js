import { LEARNING_DIMENSIONS } from "./prompt.js";

const VALID_RISK_SEVERITIES = new Set(["low", "medium", "high"]);

export function validateAnalysis(value) {
  const errors = [];
  if (!value || typeof value !== "object") {
    return { ok: false, errors: ["analysis must be an object"] };
  }
  if (!hasText(value.summary)) errors.push("summary is required");
  if (!isScore(value.learning_value?.score)) errors.push("learning_value.score is required");
  if (!["low", "medium", "high"].includes(value.learning_value?.level)) errors.push("learning_value.level is invalid");
  validateBreakdown(value.learning_value?.breakdown, errors);
  validateReasons(value.learning_value?.reasons, errors);
  validateReadingPath(value.recommended_reading_path, errors);
  validateRisks(value.risks, errors);
  if (!isScore(value.confidence?.score)) errors.push("confidence.score is required");
  return {
    ok: errors.length === 0,
    errors
  };
}

export function coerceAnalysis(value = {}) {
  return {
    schema_version: value.schema_version || "1.0",
    summary: String(value.summary || "").slice(0, 80),
    problem_solved: String(value.problem_solved || value.summary || ""),
    why_it_matters_now: String(value.why_it_matters_now || ""),
    learning_value: {
      score: clampInteger(value.learning_value?.score),
      level: value.learning_value?.level || scoreLevel(value.learning_value?.score || 0),
      breakdown: normalizeBreakdown(value.learning_value?.breakdown || value.scoring_breakdown),
      reasons: (value.learning_value?.reasons || []).slice(0, 4).map((item) => ({
        reason: String(item?.reason ?? (typeof item === "string" ? item : "")),
        evidence: String(item?.evidence ?? "")
      }))
    },
    trend_explanation: value.trend_explanation || { score_hint: "中", signals: [] },
    audience: (value.audience || []).slice(0, 4).map(String),
    profile_fit: {
      score: clampInteger(value.profile_fit?.score),
      why_for_this_user: String(value.profile_fit?.why_for_this_user || "")
    },
    recommended_reading_path: (value.recommended_reading_path || []).slice(0, 5).map((item, index) => ({
      step: Number(item?.step || index + 1),
      action: String(item?.action ?? (typeof item === "string" ? item : "")),
      goal: String(item?.goal ?? "")
    })),
    project_idea: String(value.project_idea || ""),
    risks: (value.risks || []).slice(0, 4).map((item) => ({
      risk: String(item?.risk ?? (typeof item === "string" ? item : "")),
      severity: normalizeSeverity(item?.severity)
    })),
    confidence: {
      score: clampInteger(value.confidence?.score),
      reason: String(value.confidence?.reason || "")
    }
  };
}

export function normalizeBreakdown(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeBreakdownItem(item)).filter(Boolean);
  }

  if (value && typeof value === "object") {
    return LEARNING_DIMENSIONS.map((dimension) =>
      normalizeBreakdownItem({
        ...dimension,
        score: value[dimension.id],
        reason: `${dimension.label}分项来自本地规则计算。`,
        evidence: dimension.question
      })
    );
  }

  return LEARNING_DIMENSIONS.map((dimension) =>
    normalizeBreakdownItem({
      ...dimension,
      score: 0,
      reason: "模型未提供该分项。",
      evidence: "无"
    })
  );
}

function normalizeBreakdownItem(item) {
  if (!item) return null;
  const dimension = LEARNING_DIMENSIONS.find((candidate) => candidate.id === item.id) || {};
  return {
    id: String(item.id || dimension.id || ""),
    label: String(item.label || dimension.label || item.id || "未知维度"),
    weight: Number.isFinite(Number(item.weight)) ? Number(item.weight) : Number(dimension.weight || 0),
    score: clampInteger(item.score),
    reason: String(item.reason || "未提供原因"),
    evidence: String(item.evidence || "证据不足")
  };
}

function clampInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function scoreLevel(score) {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function validateBreakdown(breakdown, errors) {
  if (!Array.isArray(breakdown) || breakdown.length === 0) {
    errors.push("learning_value.breakdown is required");
    return;
  }

  const expectedIds = new Set(LEARNING_DIMENSIONS.map((dimension) => dimension.id));
  const seenIds = new Set();
  for (const item of breakdown) {
    if (!expectedIds.has(item.id)) errors.push(`unknown breakdown dimension: ${item.id}`);
    if (seenIds.has(item.id)) errors.push(`duplicate breakdown dimension: ${item.id}`);
    seenIds.add(item.id);
    if (!isScore(item.score)) errors.push(`breakdown score is invalid: ${item.id}`);
    if (!hasText(item.reason)) errors.push(`breakdown reason is required: ${item.id}`);
    if (!hasText(item.evidence)) errors.push(`breakdown evidence is required: ${item.id}`);
  }
}

function validateReasons(reasons, errors) {
  if (!Array.isArray(reasons) || reasons.length === 0) {
    errors.push("learning_value.reasons is required");
    return;
  }
  for (const [index, reason] of reasons.entries()) {
    if (!hasText(reason.reason)) errors.push(`learning_value.reasons[${index}].reason is required`);
    if (!hasText(reason.evidence)) errors.push(`learning_value.reasons[${index}].evidence is required`);
  }
}

function validateReadingPath(path, errors) {
  if (!Array.isArray(path) || path.length === 0) {
    errors.push("recommended_reading_path is required");
    return;
  }
  for (const [index, step] of path.entries()) {
    if (!Number.isFinite(Number(step.step))) errors.push(`recommended_reading_path[${index}].step is required`);
    if (!hasText(step.action)) errors.push(`recommended_reading_path[${index}].action is required`);
    if (!hasText(step.goal)) errors.push(`recommended_reading_path[${index}].goal is required`);
  }
}

function validateRisks(risks, errors) {
  if (!Array.isArray(risks) || risks.length === 0) {
    errors.push("risks is required");
    return;
  }
  for (const [index, risk] of risks.entries()) {
    if (!hasText(risk.risk)) errors.push(`risks[${index}].risk is required`);
    if (!VALID_RISK_SEVERITIES.has(risk.severity)) errors.push(`risks[${index}].severity is invalid`);
  }
}

function normalizeSeverity(value) {
  return VALID_RISK_SEVERITIES.has(value) ? value : "medium";
}

function hasText(value) {
  return String(value ?? "").trim().length > 0;
}

function isScore(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100;
}
