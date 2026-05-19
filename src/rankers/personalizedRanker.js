import { daysBetween } from "../shared/date.js";
import { clamp, round } from "../shared/math.js";
import { calculateProfileMatchScore } from "../scorers/profileMatch.js";
import { estimateLearningCost } from "../scorers/learningCost.js";
import { classifyRepo, isDeepReadEligibleClass, isProjectInspirationClass } from "./repoClassifier.js";

const MAX_STRONG_RECOMMENDATIONS = 3;
const MAX_DEEP_READ_ITEMS = 3;

export function rankAnalyzedRepos({
  repos,
  analyses,
  analysisMeta = new Map(),
  trends,
  profile,
  recentRepoIds = new Set(),
  referenceDate,
  limit = 10,
  documents = new Map()
}) {
  const items = repos
    .map((repo) => {
      const analysis = analyses.get(String(repo.repo_id));
      if (!analysis) return null;
      const trend = trends.get(String(repo.repo_id)) || { trend_score: 0 };
      const repoClass = classifyRepo(repo, analysis);
      const document = documents.get(String(repo.repo_id));
      const learningCost = analysis.learning_cost || estimateLearningCost({ repo, analysis, profile, documents: document, repoClass });
      const analysisWithLearningCost = analysis.learning_cost ? analysis : { ...analysis, learning_cost: learningCost };
      const analysisText = JSON.stringify(analysis);
      const learningScore = Number(analysis.learning_value?.score || 0);
      const profileMatchScore = Number(analysis.profile_fit?.score || calculateProfileMatchScore(repo, profile, analysisText));
      const investmentFitScore = Number(learningCost.investment_fit_score || 0);
      const noveltyScore = recentRepoIds.has(String(repo.repo_id)) ? 30 : 90;
      const penaltyScore = calculatePenalty(repo, analysisWithLearningCost, referenceDate);
      const personalizedScore =
        0.25 * Number(trend.trend_score || 0) +
        0.4 * learningScore +
        0.2 * profileMatchScore +
        0.1 * investmentFitScore +
        0.05 * noveltyScore -
        penaltyScore;

      return {
        repo,
        analysis: analysisWithLearningCost,
        analysis_meta: analysisMeta.get(String(repo.repo_id)) || null,
        trend,
        repo_class: repoClass,
        document_status: summarizeDocumentStatus(document),
        scores: {
          trend_score: round(Number(trend.trend_score || 0), 1),
          learning_score: round(learningScore, 1),
          profile_match_score: round(profileMatchScore, 1),
          investment_fit_score: round(investmentFitScore, 1),
          novelty_score: round(noveltyScore, 1),
          penalty_score: round(penaltyScore, 1),
          personalized_score: round(clamp(personalizedScore), 1)
        }
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.scores.personalized_score - a.scores.personalized_score);

  const placedItems = placeRankedItems(items);

  return {
    items: placedItems.slice(0, limit),
    allItems: placedItems
  };
}

export function calculatePenalty(repo, analysis, referenceDate) {
  let penalty = 0;
  if (!repo.license) penalty += 4;
  if (repo.archived) penalty += 30;
  if (daysBetween(repo.pushed_at, referenceDate) > 180) penalty += 10;
  if (Number(analysis.confidence?.score || 0) < 60) penalty += 12;
  if (analysis.risks?.some((risk) => risk.severity === "high")) penalty += 8;
  if (analysis.learning_cost?.level === "high") penalty += 8;
  return penalty;
}

function placeRankedItems(items) {
  let strongCount = 0;
  let deepReadCount = 0;

  return items.map((item, index) => {
    const category = categorize(item, { deepReadCount });
    if (category === "今日最值得深读") deepReadCount += 1;

    const recommendationLevel = recommendationLevelFor(item, {
      index,
      category,
      strongCount
    });
    if (recommendationLevel === "强推荐") strongCount += 1;

    return {
      ...item,
      category,
      recommendation_level: recommendationLevel
    };
  });
}

function categorize(item, { deepReadCount = 0 } = {}) {
  const { trend, analysis, repo_class: repoClass, scores } = item;
  const learningScore = scores.learning_score;
  const profileMatchScore = scores.profile_match_score;
  const penaltyScore = scores.penalty_score;
  const confidenceScore = Number(analysis.confidence?.score || 0);

  if (hasRecommendationBlockingRisk(item)) return "谨慎关注";
  if (isProjectInspirationClass(repoClass)) return "可转化为项目灵感";
  if (hasHighLearningCost(item) && hasProjectInspirationValue(analysis, scores)) return "可转化为项目灵感";
  if (hasHighLearningCost(item) && (isFastRising(trend) || Number(trend.trend_score || 0) >= 70)) return "上升很快，值得观察";
  if (hasHighLearningCost(item) && profileMatchScore < 60) return "谨慎关注";
  if (isWeakProfileButHot(item)) return "上升很快，值得观察";

  if (
    deepReadCount < MAX_DEEP_READ_ITEMS &&
    isDeepReadEligibleClass(repoClass) &&
    learningScore >= 80 &&
    profileMatchScore >= 70 &&
    confidenceScore >= 75 &&
    hasConcreteEvidence(analysis) &&
    !hasRecommendationBlockingRisk(item) &&
    !hasHighLearningCost(item)
  ) {
    return "今日最值得深读";
  }

  if (isFastRising(trend) || (Number(trend.trend_score || 0) >= 70 && (confidenceScore < 75 || learningScore < 80))) {
    return "上升很快，值得观察";
  }

  if (hasProjectInspirationValue(analysis, scores)) return "可转化为项目灵感";
  return "谨慎关注";
}

function recommendationLevelFor(item, { index, category, strongCount }) {
  const { analysis, repo_class: repoClass, scores } = item;
  const confidenceScore = Number(analysis.confidence?.score || 0);

  if (
    category === "今日最值得深读" &&
    strongCount < MAX_STRONG_RECOMMENDATIONS &&
    index < MAX_STRONG_RECOMMENDATIONS &&
    scores.personalized_score >= 75 &&
    scores.learning_score >= 80 &&
    confidenceScore >= 75 &&
    isDeepReadEligibleClass(repoClass) &&
    !hasRecommendationBlockingRisk(item) &&
    !hasHighLearningCost(item)
  ) {
    return "强推荐";
  }

  if (category === "可转化为项目灵感") return "项目灵感";
  if (category === "上升很快，值得观察") return "值得观察";
  if (scores.personalized_score >= 65 && !hasHighRisk(analysis)) return "值得观察";
  return "谨慎关注";
}

function isFastRising(trend = {}) {
  return Number(trend.stars_1d || 0) >= 500 || Number(trend.stars_7d || 0) >= 1000 || Number(trend.forks_7d || 0) >= 150;
}

function hasHighRisk(analysis = {}) {
  return analysis.risks?.some((risk) => risk.severity === "high");
}

function hasRecommendationBlockingRisk(item = {}) {
  const confidenceScore = Number(item.analysis?.confidence?.score || 0);
  return hasHighRisk(item.analysis) || confidenceScore < 60 || Number(item.scores?.penalty_score || 0) >= 18;
}

function hasHighLearningCost(item = {}) {
  return item.analysis?.learning_cost?.level === "high" || Number(item.scores?.investment_fit_score || 0) < 45;
}

function isWeakProfileButHot(item = {}) {
  const profileMatchScore = Number(item.scores?.profile_match_score || 0);
  const trendScore = Number(item.trend?.trend_score || 0);
  return profileMatchScore < 60 && (trendScore >= 70 || isFastRising(item.trend));
}

function hasConcreteEvidence(analysis = {}) {
  const reasons = analysis.learning_value?.reasons || [];
  return reasons.filter((reason) => String(reason.evidence || "").trim().length >= 12).length >= 2;
}

function hasProjectInspirationValue(analysis = {}, scores = {}) {
  if (!String(analysis.project_idea || "").trim()) return false;
  if (Number(scores.learning_score || 0) < 70 || Number(scores.profile_match_score || 0) < 60) return false;
  return getBreakdownScore(analysis, "practical_transfer_value") >= 85 && hasConcreteEvidence(analysis);
}

function getBreakdownScore(analysis = {}, id) {
  const item = (analysis.learning_value?.breakdown || []).find((candidate) => candidate.id === id);
  return Number(item?.score || 0);
}

function summarizeDocumentStatus(document) {
  return {
    readme_status: document?.readme_status || "unknown",
    readme_chars: Number(document?.readme_text?.length || 0),
    release_status: document?.latest_release_notes ? "present" : "missing",
    release_chars: Number(document?.latest_release_notes?.length || 0),
    last_fetched_at: document?.last_fetched_at || ""
  };
}
