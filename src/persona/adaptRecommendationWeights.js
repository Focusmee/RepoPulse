const HINTS = {
  demo_friendliness: "更重视能快速跑出 demo 的项目",
  setup_cost_penalty: "更严格惩罚安装、配置和外部依赖成本高的项目",
  documentation_quality: "更重视 README、示例和教程质量",
  architecture_clarity: "更重视架构清晰度和源码入口",
  integration_potential: "更重视 API、SDK、CLI、MCP 或工作流集成能力",
  productization_potential: "更重视可产品化、可包装成工具或 SaaS 的机会",
  trend_signal: "更重视趋势信号和生态变化",
  risk_penalty: "更严格惩罚高风险、维护不明或不适合试点的项目",
  license_clarity: "更重视许可证清晰度",
  maintenance_signal: "更重视维护活跃度和长期可用性",
  portfolio_value: "更重视作品集和简历展示价值",
  clear_use_case: "更重视真实场景和明确用户问题",
  ecosystem_signal: "更重视生态位和新范式信号"
};

export function adaptRecommendationWeights(weights = {}) {
  const normalizedWeights = normalizeWeights(weights);
  return {
    explanation_hints: buildExplanationHints(normalizedWeights),
    experimental_ranking_adjustments: normalizedWeights
  };
}

function normalizeWeights(weights = {}) {
  const result = {};
  if (!weights || typeof weights !== "object" || Array.isArray(weights)) return result;

  for (const [key, value] of Object.entries(weights)) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) {
      result[key] = Math.round(number * 100) / 100;
    }
  }
  return result;
}

function buildExplanationHints(weights) {
  return Object.entries(weights)
    .filter(([, weight]) => weight >= 1.2)
    .sort((a, b) => b[1] - a[1])
    .map(([key, weight]) => ({
      id: key,
      weight,
      hint: HINTS[key] || `更重视 ${key}`
    }));
}
