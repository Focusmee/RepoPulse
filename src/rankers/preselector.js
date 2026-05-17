import { calculateProfileMatchScore } from "../scorers/profileMatch.js";
import { clamp, round } from "../shared/math.js";

export function preselectRepos({ repos, trends, profile, limit }) {
  const targetLimit = Math.max(0, Math.min(Number(limit || 0), repos.length));
  if (targetLimit === 0) return [];

  const scored = repos.map((repo) => scorePreselection(repo, trends, profile));
  const selected = new Map();

  addTop(selected, scored.filter((item) => item.watchlistBoost > 0), Math.ceil(targetLimit * 0.2));
  addTop(selected, scored.filter((item) => item.profileScore >= 55), Math.ceil(targetLimit * 0.3));
  addTop(selected, scored, targetLimit);

  return Array.from(selected.values())
    .sort((a, b) => b.preselectionScore - a.preselectionScore)
    .slice(0, targetLimit)
    .map((item) => item.repo);
}

export function scorePreselection(repo, trends, profile) {
  const trendScore = Number(trends.get(String(repo.repo_id))?.trend_score || 0);
  const profileScore = calculateProfileMatchScore(repo, profile);
  const watchlistBoost = (repo.source_tags || []).some((tag) => String(tag).startsWith("watchlist:")) ? 15 : 0;
  const preselectionScore = clamp(0.6 * trendScore + 0.35 * profileScore + watchlistBoost);

  return {
    repo,
    trendScore: round(trendScore, 1),
    profileScore: round(profileScore, 1),
    watchlistBoost,
    preselectionScore: round(preselectionScore, 1)
  };
}

function addTop(selected, scored, quota) {
  for (const item of scored.slice().sort((a, b) => b.preselectionScore - a.preselectionScore)) {
    if (selected.size >= quota) break;
    selected.set(String(item.repo.repo_id), item);
  }
}
