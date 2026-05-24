import { scoreSbtiAnswers } from "./scoreSbtiAnswers.js";

const INDUSTRY_TOPICS = {
  developer_tools: ["developer-tools", "cli", "sdk", "mcp", "automation"],
  content_creation: ["content-generation", "llm", "workflow", "automation", "media-tools"],
  data_analysis: ["data-analysis", "analytics", "visualization", "notebook", "ai-tools"],
  education: ["education", "learning", "tutor", "course", "knowledge-base"],
  ecommerce_growth: ["marketing-tools", "ecommerce", "growth", "automation", "content-generation"],
  enterprise_workflow: ["workflow", "enterprise", "automation", "agent", "integration"],
  portfolio_job: ["full-stack", "developer-tools", "agent", "portfolio", "template"],
  general_ai_apps: ["llm", "agent", "rag", "ai-apps", "automation"]
};

const GOAL_TOPICS = {
  quick_demo: ["demo", "template", "starter", "agent", "developer-tools"],
  deep_learning: ["framework", "architecture", "infrastructure", "runtime", "llm"],
  product_idea: ["saas", "indie-hacker", "productivity", "automation", "workflow"],
  portfolio: ["full-stack", "template", "dashboard", "agent", "portfolio"],
  work_automation: ["workflow", "automation", "integration", "cli", "agent"],
  trend_tracking: ["trending", "agent", "mcp", "llm", "ai-agents"],
  startup_validation: ["saas", "business-workflow", "automation", "content-tool", "agent"]
};

const PROJECT_TYPE_TOPICS = {
  "developer-tools": ["developer-tools"],
  agent: ["agent", "ai-agents"],
  automation: ["automation", "workflow"],
  mcp: ["mcp"],
  sdk: ["sdk"],
  api: ["api"],
  cli: ["cli"],
  workflow: ["workflow"],
  integration: ["integration"],
  framework: ["framework"],
  infrastructure: ["infrastructure"],
  "indie-hacker": ["indie-hacker", "saas"],
  saas: ["saas"],
  "content-tool": ["content-generation"],
  "business workflow": ["business-workflow", "workflow"],
  "agent-native": ["agent", "ai-agents"],
  trending: ["trending"],
  "enterprise workflow": ["enterprise", "workflow"]
};

const TIME_BUDGET_TO_PROFILE = {
  ten_minutes: "quick-scan",
  thirty_minutes: "quick-scan",
  half_day: "weekend",
  two_three_days: "deep-study",
  one_two_weeks: "deep-study"
};

const SKILL_LEVEL_BY_EXPERTISE = {
  beginner_or_busy: "junior",
  intermediate: "intermediate",
  advanced_or_deep: "senior"
};

const PROJECT_SIZE_BY_TIME_BUDGET = {
  ten_minutes: "small",
  thirty_minutes: "small",
  half_day: "medium",
  two_three_days: "medium",
  one_two_weeks: "large"
};

const GOAL_PRIORITY_BY_GOAL = {
  quick_demo: ["ship_demo", "follow_trend"],
  deep_learning: ["learn_architecture", "ship_demo"],
  product_idea: ["ship_demo", "follow_trend"],
  portfolio: ["resume_project", "ship_demo", "learn_architecture"],
  work_automation: ["ship_demo", "learn_architecture"],
  trend_tracking: ["follow_trend", "learn_architecture"],
  startup_validation: ["ship_demo", "follow_trend"]
};

const DAILY_LIMIT_BY_TIME_BUDGET = {
  ten_minutes: 5,
  thirty_minutes: 6,
  half_day: 8,
  two_three_days: 8,
  one_two_weeks: 10
};

export function buildProfileFromSbti({ answers, sbtiResult, tags, generatedBy = "scripts/generate-sbti-profile.js" } = {}) {
  const result = sbtiResult || scoreSbtiAnswers(answers);
  const effectiveTags = tags || result.tags;
  const rawAnswers = result.answers || answers || {};
  const persona = result.sbtiType;
  const industry = effectiveTags.industry_tags?.[0] || "general_ai_apps";
  const goal = rawAnswers.q6 || "quick_demo";
  const rawTimeBudget = effectiveTags.time_budget || rawAnswers.q7 || "half_day";
  const profileTimeBudget = TIME_BUDGET_TO_PROFILE[rawTimeBudget] || "weekend";
  const expertiseLevel = effectiveTags.expertise_level || "intermediate";
  const topics = buildInterestedTopics({ industry, goal, persona });

  return {
    profile_id: buildProfileId({ rawCode: result.rawCode, industry, rawTimeBudget }),
    generated_by: generatedBy,
    generated_note: "由 SBTI 脚本生成；如需修改画像，请优先调整 answers 或 src/persona/buildProfileFromSbti.js。",
    persona_type: "SBTI",
    persona_code: result.personaCode,
    persona_raw_code: result.rawCode,
    persona_name: persona.name,
    role: roleFor(rawAnswers, industry),
    preferred_languages: [],
    interested_topics: topics,
    learning_goals: effectiveTags.learning_goals || [],
    excluded_topics: [],
    skill_level: SKILL_LEVEL_BY_EXPERTISE[expertiseLevel] || "intermediate",
    known_stack: knownStackFor(topics),
    weak_areas: weakAreasFor({ rawTimeBudget, painPoint: rawAnswers.q8 }),
    time_budget: profileTimeBudget,
    preferred_project_size: PROJECT_SIZE_BY_TIME_BUDGET[rawTimeBudget] || "medium",
    goal_priority: GOAL_PRIORITY_BY_GOAL[goal] || ["learn_architecture", "ship_demo"],
    daily_limit: DAILY_LIMIT_BY_TIME_BUDGET[rawTimeBudget] || 8,
    industry_tags: effectiveTags.industry_tags || [],
    expertise_level: expertiseLevel,
    raw_time_budget: rawTimeBudget,
    tech_stack_friction: effectiveTags.tech_stack_friction,
    current_pain_points: effectiveTags.current_pain_points || [],
    preferred_project_traits: effectiveTags.preferred_project_traits || [],
    avoid_project_traits: effectiveTags.avoid_project_traits || [],
    report_explanation_style: effectiveTags.report_explanation_style,
    recommendationWeights: persona.recommendationWeights,
    persona_metadata: {
      source: "sbti",
      raw_code: result.rawCode,
      resolved_code: result.personaCode,
      resolved_by: result.resolvedBy,
      dimensions: result.dimensions,
      answers: rawAnswers,
      industry_tags: effectiveTags.industry_tags || [],
      expertise_level: expertiseLevel,
      raw_time_budget: rawTimeBudget,
      tech_stack_friction: effectiveTags.tech_stack_friction,
      current_pain_points: effectiveTags.current_pain_points || [],
      preferred_project_traits: effectiveTags.preferred_project_traits || [],
      avoid_project_traits: effectiveTags.avoid_project_traits || [],
      report_explanation_style: effectiveTags.report_explanation_style,
      recommendationWeights: persona.recommendationWeights
    }
  };
}

function buildInterestedTopics({ industry, goal, persona }) {
  return unique([
    ...(INDUSTRY_TOPICS[industry] || INDUSTRY_TOPICS.general_ai_apps),
    ...(GOAL_TOPICS[goal] || []),
    ...topicHintsFromProjectTypes(persona.bestProjectTypes)
  ]).slice(0, 12);
}

function topicHintsFromProjectTypes(projectTypes = []) {
  return projectTypes.flatMap((projectType) => PROJECT_TYPE_TOPICS[String(projectType).toLowerCase()] || []);
}

function knownStackFor(topics) {
  const stack = ["LLM", "OpenAI API", "GitHub"];
  if (topics.includes("agent") || topics.includes("ai-agents")) stack.push("Agent");
  if (topics.includes("mcp")) stack.push("MCP");
  if (topics.includes("workflow") || topics.includes("automation")) stack.push("Workflow Automation");
  return unique(stack);
}

function weakAreasFor({ rawTimeBudget, painPoint }) {
  const weakAreas = [];
  if (rawTimeBudget === "ten_minutes" || rawTimeBudget === "thirty_minutes") {
    weakAreas.push("Kubernetes", "复杂部署", "底层模型训练", "大规模分布式系统");
  }
  if (painPoint === "cant_run_locally") weakAreas.push("复杂部署", "外部服务配置");
  if (painPoint === "cant_understand_architecture") weakAreas.push("复杂架构", "大型代码库");
  return unique(weakAreas);
}

function roleFor(answers, industry) {
  if (answers.q4 === "A") return "AI 应用开发者 / 独立开发者";
  if (industry === "portfolio_job") return "想做 AI 项目的求职开发者";
  if (industry === "enterprise_workflow") return "面向团队落地的 AI 工程实践者";
  return "AI 开发者 / 职业成长型工程师";
}

function buildProfileId({ rawCode, industry, rawTimeBudget }) {
  return `sbti-${kebab(rawCode)}-${kebab(industry)}-${kebab(rawTimeBudget)}`;
}

function kebab(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
