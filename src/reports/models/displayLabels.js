const LEVEL_LABELS = {
  low: "低",
  medium: "中",
  high: "高"
};

const LEARNING_COST_LABELS = {
  low: "低成本",
  medium: "中等成本",
  high: "高成本"
};

const RISK_SEVERITY_LABELS = {
  low: "低风险",
  medium: "中风险",
  high: "高风险"
};

const QUALITY_WARNING_LABELS = {
  low: "低",
  medium: "中",
  high: "高",
  warning: "警告",
  error: "错误"
};

export function formatLevel(value) {
  return labelFromMap(LEVEL_LABELS, value);
}

export function formatLearningCostLevel(value) {
  return labelFromMap(LEARNING_COST_LABELS, value);
}

export function formatRiskSeverity(value) {
  return labelFromMap(RISK_SEVERITY_LABELS, value);
}

export function formatQualityWarningLevel(value) {
  return labelFromMap(QUALITY_WARNING_LABELS, value);
}

function labelFromMap(map, value) {
  const key = String(value || "").toLowerCase();
  return map[key] || String(value || "未知");
}
