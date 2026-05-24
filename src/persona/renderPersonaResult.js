import { labelForAnswer } from "./sbtiQuestions.js";

export function renderPersonaResult({ sbtiResult, tags, profile } = {}) {
  if (!sbtiResult?.sbtiType) {
    throw new Error("renderPersonaResult requires sbtiResult from scoreSbtiAnswers");
  }

  const effectiveTags = tags || sbtiResult.tags || {};
  const answers = sbtiResult.answers || {};
  const persona = sbtiResult.sbtiType;
  const recommendationStrategy = buildRecommendationStrategy({ persona, tags: effectiveTags });

  return {
    headline: `你是 ${sbtiResult.personaCode} / ${persona.name}`,
    subheadline: persona.funnyDescription,
    personaCode: sbtiResult.personaCode,
    personaRawCode: sbtiResult.rawCode,
    personaName: persona.name,
    nickname: persona.nickname,
    funnyDescription: persona.funnyDescription,
    seriousDescription: persona.seriousDescription,
    visualPrompt: persona.visualPersonaPrompt,
    profileSummary: {
      industry: labelForAnswer("q5", answers.q5),
      goal: labelForAnswer("q6", answers.q6),
      timeBudget: labelForAnswer("q7", answers.q7),
      painPoint: labelForAnswer("q8", answers.q8)
    },
    recommendationStrategy,
    dailyReportIntro: buildDailyReportIntro({ persona, tags: effectiveTags, profile })
  };
}

function buildRecommendationStrategy({ persona, tags }) {
  const traitStrategies = [
    ["clear_quickstart", "优先推荐 Quick Start 清晰的项目"],
    ["demo_friendly", "优先推荐能快速跑出 demo 的项目"],
    ["low_setup_cost", "优先推荐安装和配置成本低的项目"],
    ["architecture_clarity", "优先推荐架构入口清楚、源码值得拆解的项目"],
    ["integration_ready", "优先推荐 API / SDK / CLI / MCP 入口清晰的项目"],
    ["productizable", "优先推荐有明确用户场景、可产品化的项目"],
    ["portfolio_ready", "优先推荐能转成作品集展示的项目"],
    ["trend_signal", "优先推荐能代表趋势和生态变化的项目"],
    ["clear_use_case", "优先推荐真实问题明确、落地场景清楚的项目"]
  ];
  const strategies = traitStrategies
    .filter(([trait]) => (tags.preferred_project_traits || []).includes(trait))
    .map(([, strategy]) => strategy);

  for (const action of persona.recommendedActions || []) {
    strategies.push(`行动建议：${action}`);
  }

  return unique(strategies).slice(0, 5);
}

function buildDailyReportIntro({ persona, tags, profile }) {
  const topics = (profile?.interested_topics || []).slice(0, 3).join(" / ");
  const trait = (tags.preferred_project_traits || []).includes("demo_friendly")
    ? "能不能快速跑起来、能不能转成 demo"
    : "是否匹配你的目标、投入成本和下一步行动";
  const topicText = topics ? `，尤其关注 ${topics} 方向` : "";
  return `今天给你筛项目时，我会优先看它${trait}${topicText}。${persona.reportTone}`;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
