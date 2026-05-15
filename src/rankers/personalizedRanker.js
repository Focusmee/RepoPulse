import { daysBetween } from "../shared/date.js";
import { clamp, round } from "../shared/math.js";
import { calculateProfileMatchScore } from "../scorers/profileMatch.js";

export function rankAnalyzedRepos({ repos, analyses, trends, profile, recentRepoIds = new Set(), limit = 10 }) {
  const items = repos
    .map((repo) => {
      const analysis = analyses.get(String(repo.repo_id));
      if (!analysis) return null;
      const trend = trends.get(String(repo.repo_id)) || { trend_score: 0 };
      const analysisText = JSON.stringify(analysis);
      const learningScore = Number(analysis.learning_value?.score || 0);
      const profileMatchScore = Number(analysis.profile_fit?.score || calculateProfileMatchScore(repo, profile, analysisText));
      const noveltyScore = recentRepoIds.has(String(repo.repo_id)) ? 30 : 90;
      const penaltyScore = calculatePenalty(repo, analysis);
      const personalizedScore =
        0.25 * Number(trend.trend_score || 0) +
        0.45 * learningScore +
        0.2 * profileMatchScore +
        0.1 * noveltyScore -
        penaltyScore;

      return {
        repo,
        analysis,
        trend,
        scores: {
          trend_score: round(Number(trend.trend_score || 0), 1),
          learning_score: round(learningScore, 1),
          profile_match_score: round(profileMatchScore, 1),
          novelty_score: round(noveltyScore, 1),
          penalty_score: round(penaltyScore, 1),
          personalized_score: round(clamp(personalizedScore), 1)
        },
        category: categorize({ trend, analysis, learningScore, profileMatchScore, penaltyScore })
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.scores.personalized_score - a.scores.personalized_score);

  return {
    items: items.slice(0, limit),
    allItems: items
  };
}

function calculatePenalty(repo, analysis) {
  let penalty = 0;
  if (!repo.license) penalty += 4;
  if (repo.archived) penalty += 30;
  if (daysBetween(repo.pushed_at) > 180) penalty += 10;
  if (Number(analysis.confidence?.score || 0) < 60) penalty += 12;
  if (analysis.risks?.some((risk) => risk.severity === "high")) penalty += 8;
  return penalty;
}

function categorize({ trend, analysis, learningScore, profileMatchScore, penaltyScore }) {
  if (learningScore >= 70 && profileMatchScore >= 45 && penaltyScore < 18 && Number(analysis.confidence?.score || 0) >= 60) {
    return "今日最值得深读";
  }
  if (Number(trend.trend_score || 0) >= 70) return "上升很快，值得观察";
  if (analysis.project_idea && learningScore >= 55) return "可转化为项目灵感";
  return "谨慎关注";
}
