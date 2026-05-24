import {
  DIMENSION_QUESTION_IDS,
  TAG_QUESTION_IDS,
  getQuestionById,
  getQuestionOption,
  getQuestionOptionValues,
  normalizeAnswerValue
} from "./sbtiQuestions.js";
import { resolveSbtiType } from "./sbtiTypes.js";

const GOAL_TAGS = {
  quick_demo: {
    learningGoals: ["快速做 demo", "发现可复刻项目"],
    preferredTraits: ["clear_quickstart", "demo_friendly", "low_setup_cost"],
    explanationStyle: "action_first"
  },
  deep_learning: {
    learningGoals: ["深入学习原理", "学习工程架构"],
    preferredTraits: ["source_readable", "architecture_clarity", "high_learning_value"],
    explanationStyle: "deep_dive"
  },
  product_idea: {
    learningGoals: ["找到产品灵感", "发现可产品化机会"],
    preferredTraits: ["clear_use_case", "productizable", "indie_hacker"],
    explanationStyle: "product_opportunity"
  },
  portfolio: {
    learningGoals: ["做作品集项目", "提升简历表达"],
    preferredTraits: ["portfolio_ready", "visible_output", "demo_friendly"],
    explanationStyle: "portfolio_output"
  },
  work_automation: {
    learningGoals: ["提升工作效率", "发现可落地自动化工具"],
    preferredTraits: ["workflow_ready", "automation_friendly", "integration_ready"],
    explanationStyle: "workflow_value"
  },
  trend_tracking: {
    learningGoals: ["跟踪趋势", "判断新技术方向"],
    preferredTraits: ["trend_signal", "ecosystem_signal", "new_paradigm"],
    explanationStyle: "trend_signal"
  },
  startup_validation: {
    learningGoals: ["验证创业方向", "发现可收费场景"],
    preferredTraits: ["clear_use_case", "productizable", "startup_validation"],
    explanationStyle: "validation_first"
  }
};

const PAIN_POINT_TRAITS = {
  dont_know_worth: {
    preferred: ["strong_learning_signal", "clear_use_case"],
    avoid: ["weak_value_signal", "unclear_positioning"]
  },
  readme_too_long: {
    preferred: ["good_docs", "guided_tutorial", "examples"],
    avoid: ["docs_only_without_path", "long_readme_without_examples"]
  },
  cant_run_locally: {
    preferred: ["clear_quickstart", "low_setup_cost", "containerized_demo"],
    avoid: ["heavy_setup_without_demo", "unclear_installation"]
  },
  cant_understand_architecture: {
    preferred: ["architecture_overview", "source_readable", "module_boundary_clear"],
    avoid: ["opaque_architecture", "large_codebase_without_map"]
  },
  dont_know_how_to_replicate: {
    preferred: ["replicable_project", "demo_friendly", "clear_use_case"],
    avoid: ["no_examples", "unclear_license", "missing_replicate_path"]
  },
  collect_too_much_no_action: {
    preferred: ["small_scope", "quick_win", "recommended_actions"],
    avoid: ["research_loop", "unclear_next_step"]
  }
};

const TIME_BUDGET_TRAITS = {
  ten_minutes: ["quick_scan", "clear_positioning"],
  thirty_minutes: ["clear_quickstart", "low_setup_cost"],
  half_day: ["runnable_examples", "demo_friendly"],
  two_three_days: ["source_readable", "portfolio_ready"],
  one_two_weeks: ["deep_architecture", "learning_roadmap"]
};

const TECH_STACK_FRICTION_BY_GOAL = {
  quick_demo: "prefer_low_setup",
  deep_learning: "agent_can_explain_unfamiliar_stack",
  product_idea: "agent_can_help",
  portfolio: "prefer_visible_demo_stack",
  work_automation: "prefer_integration_ready_stack",
  trend_tracking: "stack_is_secondary",
  startup_validation: "prefer_validation_speed"
};

export function scoreSbtiAnswers(answers = {}) {
  const normalizedAnswers = normalizeAnswers(answers);
  const dimensionOptions = DIMENSION_QUESTION_IDS.map((questionId) => getQuestionOption(questionId, normalizedAnswers[questionId]));
  const rawCode = dimensionOptions.map((option) => option.mapsTo).join("");
  const resolved = resolveSbtiType(rawCode);
  const tags = buildTags(normalizedAnswers, resolved.type);

  return {
    answers: normalizedAnswers,
    rawCode,
    personaCode: resolved.code,
    personaName: resolved.type.name,
    resolvedBy: resolved.resolvedBy,
    dimensions: {
      action_style: dimensionOptions[0].mapsTo,
      build_style: dimensionOptions[1].mapsTo,
      value_preference: dimensionOptions[2].mapsTo,
      target_scene: dimensionOptions[3].mapsTo
    },
    tags,
    sbtiType: resolved.type
  };
}

function normalizeAnswers(answers = {}) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    throw new Error("SBTI answers must be an object");
  }

  const normalized = {};
  for (const questionId of [...DIMENSION_QUESTION_IDS, ...TAG_QUESTION_IDS]) {
    const question = getQuestionById(questionId);
    const value = normalizeAnswerValue(questionId, answers[questionId]);
    if (!value) {
      throw new Error(`缺少 SBTI 答案：${questionId}`);
    }
    const option = getQuestionOption(questionId, value);
    if (!option) {
      throw new Error(`非法 SBTI 答案：${questionId}=${value}，可选值：${getQuestionOptionValues(questionId).join(", ")}`);
    }
    if (!question) {
      throw new Error(`未知 SBTI 题目：${questionId}`);
    }
    normalized[questionId] = value;
  }
  return normalized;
}

function buildTags(answers, sbtiType) {
  const goal = answers.q6;
  const timeBudget = answers.q7;
  const painPoint = answers.q8;
  const goalTags = GOAL_TAGS[goal];
  const painTraits = PAIN_POINT_TRAITS[painPoint];

  return {
    industry_tags: [answers.q5],
    learning_goals: goalTags.learningGoals,
    expertise_level: expertiseLevelFromTimeBudget(timeBudget),
    time_budget: timeBudget,
    tech_stack_friction: TECH_STACK_FRICTION_BY_GOAL[goal] || "agent_can_help",
    current_pain_points: [painPoint],
    preferred_project_traits: unique([
      ...goalTags.preferredTraits,
      ...(TIME_BUDGET_TRAITS[timeBudget] || []),
      ...(painTraits?.preferred || []),
      ...projectTypeTraits(sbtiType.bestProjectTypes)
    ]),
    avoid_project_traits: unique([...(painTraits?.avoid || []), ...projectTypeTraits(sbtiType.avoidProjectTypes)]),
    report_explanation_style: goalTags.explanationStyle
  };
}

function expertiseLevelFromTimeBudget(timeBudget) {
  if (timeBudget === "ten_minutes" || timeBudget === "thirty_minutes") return "beginner_or_busy";
  if (timeBudget === "half_day") return "intermediate";
  return "advanced_or_deep";
}

function projectTypeTraits(values = []) {
  return values.map((value) => String(value).trim().toLowerCase().replace(/\s+/g, "_")).filter(Boolean);
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
