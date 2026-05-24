import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sbtiConfig = require("../../config/personas/sbti-types.json");

const REQUIRED_TYPE_FIELDS = [
  "code",
  "name",
  "nickname",
  "shortDescription",
  "funnyDescription",
  "seriousDescription",
  "strengths",
  "blindspots",
  "bestProjectTypes",
  "avoidProjectTypes",
  "recommendationWeights",
  "visualPersonaPrompt",
  "reportTone",
  "recommendedActions"
];

export const SBTI_TYPES = Object.freeze((sbtiConfig.types || []).map(normalizeType));
export const RECOMMENDATION_WEIGHT_TERMS = Object.freeze(sbtiConfig.recommendationWeightTerms || {});

const TYPE_BY_CODE = new Map(SBTI_TYPES.map((type) => [type.code, type]));
const ALIAS_TO_CODE = new Map();

for (const type of SBTI_TYPES) {
  for (const alias of type.aliases || []) {
    const normalizedAlias = normalizeSbtiCode(alias);
    if (!/^[SR][BM][TP][IC]$/.test(normalizedAlias)) {
      throw new Error(`SBTI alias is not a valid 4-dimension code: ${normalizedAlias}`);
    }
    if (TYPE_BY_CODE.has(normalizedAlias)) {
      throw new Error(`SBTI alias conflicts with a direct type code: ${normalizedAlias}`);
    }
    if (ALIAS_TO_CODE.has(normalizedAlias)) {
      throw new Error(`SBTI alias duplicated: ${normalizedAlias}`);
    }
    ALIAS_TO_CODE.set(normalizedAlias, type.code);
  }
}

for (const type of SBTI_TYPES) {
  validateType(type);
}

export function getSbtiTypes() {
  return SBTI_TYPES;
}

export function getRecommendationWeightTerms() {
  return RECOMMENDATION_WEIGHT_TERMS;
}

export function getSbtiType(code) {
  return TYPE_BY_CODE.get(normalizeSbtiCode(code)) || null;
}

export function resolveSbtiType(rawCode) {
  const normalizedCode = normalizeSbtiCode(rawCode);
  const directType = TYPE_BY_CODE.get(normalizedCode);
  if (directType) {
    return {
      rawCode: normalizedCode,
      code: directType.code,
      type: directType,
      resolvedBy: "direct"
    };
  }

  const aliasCode = ALIAS_TO_CODE.get(normalizedCode);
  const aliasType = aliasCode ? TYPE_BY_CODE.get(aliasCode) : null;
  if (aliasType) {
    return {
      rawCode: normalizedCode,
      code: aliasType.code,
      type: aliasType,
      resolvedBy: "alias"
    };
  }

  throw new Error(`无法解析 SBTI 人格代码：${normalizedCode}`);
}

export function normalizeSbtiCode(code) {
  return String(code || "").trim().toUpperCase();
}

function normalizeType(type) {
  return Object.freeze({
    ...type,
    aliases: Object.freeze((type.aliases || []).map(normalizeSbtiCode)),
    strengths: Object.freeze(type.strengths || []),
    blindspots: Object.freeze(type.blindspots || []),
    bestProjectTypes: Object.freeze(type.bestProjectTypes || []),
    avoidProjectTypes: Object.freeze(type.avoidProjectTypes || []),
    recommendedActions: Object.freeze(type.recommendedActions || []),
    recommendationWeights: Object.freeze(type.recommendationWeights || {})
  });
}

function validateType(type) {
  for (const field of REQUIRED_TYPE_FIELDS) {
    if (type[field] === undefined || type[field] === null) {
      throw new Error(`SBTI type ${type.code || "(unknown)"} missing required field: ${field}`);
    }
  }
  if (!/^[SR][BM][TP][IC]$/.test(type.code)) {
    throw new Error(`SBTI type code is not a valid 4-dimension code: ${type.code}`);
  }
}
