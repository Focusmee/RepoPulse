export const DIMENSION_QUESTION_IDS = Object.freeze(["q1", "q2", "q3", "q4"]);
export const TAG_QUESTION_IDS = Object.freeze(["q5", "q6", "q7", "q8"]);

export const SBTI_QUESTIONS = Object.freeze([
  {
    id: "q1",
    text: "看到一个 20k Star 的 AI 项目，你第一反应是？",
    kind: "dimension",
    dimension: "action_style",
    options: Object.freeze([
      { value: "A", label: "先跑起来，能不能用马上就知道", mapsTo: "S" },
      { value: "B", label: "先看 README、架构、issue，别急着开搞", mapsTo: "R" }
    ])
  },
  {
    id: "q2",
    text: "做 AI 应用时，你更像哪种人？",
    kind: "dimension",
    dimension: "build_style",
    options: Object.freeze([
      { value: "A", label: "核心模块我想自己理解甚至重写一遍", mapsTo: "B" },
      { value: "B", label: "能用现成工具拼起来就先拼起来", mapsTo: "M" }
    ])
  },
  {
    id: "q3",
    text: "你看开源项目更容易被什么打动？",
    kind: "dimension",
    dimension: "value_preference",
    options: Object.freeze([
      { value: "A", label: "这个方向很新，可能是下一波趋势", mapsTo: "T" },
      { value: "B", label: "这个问题很真实，我现在就可能用得上", mapsTo: "P" }
    ])
  },
  {
    id: "q4",
    text: "你关注项目更多是为了？",
    kind: "dimension",
    dimension: "target_scene",
    options: Object.freeze([
      { value: "A", label: "做自己的产品、小工具、独立开发灵感", mapsTo: "I" },
      { value: "B", label: "提升职业能力、作品集、团队落地或简历表达", mapsTo: "C" }
    ])
  },
  {
    id: "q5",
    text: "你最关注哪个行业 / 场景？",
    kind: "tag",
    tag: "industry",
    options: Object.freeze([
      { value: "developer_tools", label: "开发者工具" },
      { value: "content_creation", label: "内容创作" },
      { value: "data_analysis", label: "数据分析" },
      { value: "education", label: "教育学习" },
      { value: "ecommerce_growth", label: "电商增长" },
      { value: "enterprise_workflow", label: "企业流程" },
      { value: "portfolio_job", label: "作品集 / 求职" },
      { value: "general_ai_apps", label: "通用 AI 应用" }
    ])
  },
  {
    id: "q6",
    text: "你当前最主要的目标是什么？",
    kind: "tag",
    tag: "goal",
    options: Object.freeze([
      { value: "quick_demo", label: "快速跑 demo" },
      { value: "deep_learning", label: "深入学习" },
      { value: "product_idea", label: "找产品灵感" },
      { value: "portfolio", label: "做作品集" },
      { value: "work_automation", label: "工作自动化" },
      { value: "trend_tracking", label: "跟踪趋势" },
      { value: "startup_validation", label: "验证创业方向" }
    ])
  },
  {
    id: "q7",
    text: "你愿意给一个开源项目投入多久？",
    kind: "tag",
    tag: "time_budget",
    options: Object.freeze([
      { value: "ten_minutes", label: "10 分钟" },
      { value: "thirty_minutes", label: "30 分钟" },
      { value: "half_day", label: "半天" },
      { value: "two_three_days", label: "2-3 天" },
      { value: "one_two_weeks", label: "1-2 周" }
    ])
  },
  {
    id: "q8",
    text: "你现在看 GitHub 项目最容易卡在哪里？",
    kind: "tag",
    tag: "pain_point",
    options: Object.freeze([
      { value: "dont_know_worth", label: "不知道值不值得看" },
      { value: "readme_too_long", label: "README 太长" },
      { value: "cant_run_locally", label: "本地跑不起来" },
      { value: "cant_understand_architecture", label: "看不懂架构" },
      { value: "dont_know_how_to_replicate", label: "不知道怎么复刻" },
      { value: "collect_too_much_no_action", label: "收藏太多但没行动" }
    ])
  }
]);

export const SAMPLE_SBTI_ANSWERS = Object.freeze({
  q1: "A",
  q2: "A",
  q3: "A",
  q4: "A",
  q5: "developer_tools",
  q6: "quick_demo",
  q7: "half_day",
  q8: "dont_know_how_to_replicate"
});

const QUESTION_BY_ID = new Map(SBTI_QUESTIONS.map((question) => [question.id, question]));

export function getSbtiQuestions() {
  return SBTI_QUESTIONS;
}

export function getQuestionById(questionId) {
  return QUESTION_BY_ID.get(questionId) || null;
}

export function getQuestionOption(questionId, value) {
  const question = getQuestionById(questionId);
  if (!question) return null;
  const normalizedValue = normalizeAnswerValue(questionId, value);
  return question.options.find((option) => option.value === normalizedValue) || null;
}

export function getQuestionOptionValues(questionId) {
  const question = getQuestionById(questionId);
  return question ? question.options.map((option) => option.value) : [];
}

export function labelForAnswer(questionId, value) {
  return getQuestionOption(questionId, value)?.label || String(value || "");
}

export function normalizeAnswerValue(questionId, value) {
  const text = String(value || "").trim();
  return DIMENSION_QUESTION_IDS.includes(questionId) ? text.toUpperCase() : text;
}
