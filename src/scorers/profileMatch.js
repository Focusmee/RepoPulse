import { clamp } from "../shared/math.js";
import { countMatches } from "../shared/text.js";

export function calculateProfileMatchScore(repo, profile, analysisText = "") {
  const repoText = [
    repo.full_name,
    repo.description,
    repo.language,
    ...(repo.topics || []),
    analysisText
  ]
    .join(" ")
    .toLowerCase();

  const languageMatch = profile.preferred_languages.some(
    (language) => repo.language?.toLowerCase() === language.toLowerCase()
  )
    ? 30
    : 0;

  const topicMatches = countMatches(repoText, profile.interested_topics);
  const goalMatches = countGoalSignals(repoText, profile.learning_goals);
  const excludedMatches = countMatches(repoText, profile.excluded_topics);

  const topicScore = Math.min(35, topicMatches * 12);
  const goalScore = Math.min(25, goalMatches * 10);
  const broadFit = repo.description ? 10 : 0;
  const penalty = Math.min(80, excludedMatches * 40);

  return clamp(languageMatch + topicScore + goalScore + broadFit - penalty);
}

export function explainProfileFit(repo, profile, score) {
  const matchedLanguages = profile.preferred_languages.filter(
    (language) => repo.language?.toLowerCase() === language.toLowerCase()
  );
  const repoText = [repo.description, ...(repo.topics || [])].join(" ").toLowerCase();
  const matchedTopics = profile.interested_topics.filter((topic) => repoText.includes(topic.toLowerCase()));

  if (score >= 70) {
    return `和你的画像匹配度高：${[...matchedLanguages, ...matchedTopics].slice(0, 4).join("、") || profile.role}`;
  }
  if (score >= 40) {
    return `和你的部分关注方向相关：${[...matchedLanguages, ...matchedTopics].slice(0, 3).join("、") || profile.role}`;
  }
  return "和当前画像关联一般，建议作为拓展视野或趋势观察。";
}

function countGoalSignals(text, goals) {
  let score = 0;
  for (const goal of goals) {
    const normalizedGoal = goal.toLowerCase();
    if (normalizedGoal.includes("找工作") || normalizedGoal.includes("简历")) {
      score += countMatches(text, ["production", "framework", "database", "distributed", "spring", "kubernetes"]);
    } else if (normalizedGoal.includes("架构") || normalizedGoal.includes("源码")) {
      score += countMatches(text, ["architecture", "core", "engine", "runtime", "compiler", "framework"]);
    } else if (normalizedGoal.includes("应用") || normalizedGoal.includes("项目")) {
      score += countMatches(text, ["app", "tool", "cli", "dashboard", "template", "sdk", "agent"]);
    } else if (normalizedGoal.includes("趋势")) {
      score += countMatches(text, ["llm", "ai", "agent", "rag", "workflow", "developer"]);
    }
  }
  return score;
}
