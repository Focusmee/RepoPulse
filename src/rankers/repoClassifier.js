const RESOURCE_COLLECTION_PATTERNS = [
  /\bawesome[-_\s]/i,
  /\bcurated\b/i,
  /\bcollection\b/i,
  /\bresource(s)?\b/i,
  /\blist(s)?\b/i,
  /资源|合集|清单|列表|集合/
];

const TEMPLATE_PATTERNS = [
  /\btemplate(s)?\b/i,
  /\bstarter(s)?\b/i,
  /\bboilerplate(s)?\b/i,
  /\bscaffold(s|ing)?\b/i,
  /\bfull-stack[-_\s]template\b/i,
  /模板|脚手架/
];

const EXAMPLE_COLLECTION_PATTERNS = [
  /\bexample(s)?\b/i,
  /\bsample(s)?\b/i,
  /\bdemo(s)?\b/i,
  /\bshowcase(s)?\b/i,
  /示例|案例/
];

const DEVELOPER_TOOL_PATTERNS = [
  /\bcli\b/i,
  /\bsdk\b/i,
  /\btool(s)?\b/i,
  /\bdevtool(s)?\b/i,
  /\bmcp\b/i,
  /开发者工具|命令行/
];

const FRAMEWORK_PATTERNS = [
  /\bframework\b/i,
  /\bplatform\b/i,
  /\borchestration\b/i,
  /\bworkflow\b/i,
  /框架|平台|编排|工作流/
];

export function classifyRepo(repo = {}, analysis = {}) {
  const repoName = repo.name || String(repo.full_name || "").split("/").pop();
  const nameText = [repoName].filter(Boolean).join(" ");
  const combinedText = [
    nameText,
    repo.description,
    ...(repo.topics || []),
    analysis.summary,
    analysis.problem_solved
  ]
    .filter(Boolean)
    .join(" ");

  if (matchesAny(nameText, RESOURCE_COLLECTION_PATTERNS) || matchesAny(combinedText, RESOURCE_COLLECTION_PATTERNS)) {
    return {
      type: "resource_collection",
      label: "资源合集",
      deep_read_eligible: false,
      reason: "仓库名称、描述或主题呈现为资源/清单/合集，更适合作为选题和灵感来源。"
    };
  }

  if (matchesAny(combinedText, TEMPLATE_PATTERNS)) {
    return {
      type: "template_or_starter",
      label: "模板/脚手架",
      deep_read_eligible: false,
      reason: "仓库更像可复刻的模板或 starter，适合做二次开发和简历项目灵感。"
    };
  }

  if (matchesAny(combinedText, EXAMPLE_COLLECTION_PATTERNS)) {
    return {
      type: "example_collection",
      label: "示例集合",
      deep_read_eligible: false,
      reason: "仓库以示例、demo 或案例为主，更适合横向参考。"
    };
  }

  if (matchesAny(combinedText, DEVELOPER_TOOL_PATTERNS)) {
    return {
      type: "developer_tool",
      label: "开发者工具",
      deep_read_eligible: true,
      reason: "仓库呈现为开发者工具，适合深入阅读设计和实现。"
    };
  }

  if (matchesAny(combinedText, FRAMEWORK_PATTERNS)) {
    return {
      type: "framework_or_platform",
      label: "框架/平台",
      deep_read_eligible: true,
      reason: "仓库呈现为框架、平台或工作流系统，适合深入分析架构。"
    };
  }

  return {
    type: "application_or_library",
    label: "应用/库",
    deep_read_eligible: true,
    reason: "仓库不是明显的资源合集或模板，默认可进入深读候选。"
  };
}

export function isProjectInspirationClass(repoClass = {}) {
  return ["resource_collection", "template_or_starter", "example_collection"].includes(repoClass.type);
}

export function isDeepReadEligibleClass(repoClass = {}) {
  return repoClass.deep_read_eligible !== false;
}

function matchesAny(value, patterns) {
  const text = String(value || "");
  return patterns.some((pattern) => pattern.test(text));
}
