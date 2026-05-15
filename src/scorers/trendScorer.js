import { addDays, daysBetween } from "../shared/date.js";
import { clamp, normalizeByMax, round } from "../shared/math.js";

export function buildSnapshots(repos, date) {
  return repos.map((repo) => ({
    repo_id: repo.repo_id,
    snapshot_date: date,
    stars: repo.stars || 0,
    forks: repo.forks || 0,
    open_issues: repo.open_issues || 0,
    watchers: repo.watchers || 0,
    pushed_at: repo.pushed_at || "",
    source_count: (repo.source_tags || []).length
  }));
}

export function calculateTrendScores(repos, store, date) {
  const features = repos.map((repo) => trendFeatures(repo, store, date));
  const normalized7d = normalizeByMax(features.map((item) => item.rawStars7d));
  const normalized1d = normalizeByMax(features.map((item) => item.rawStars1d));
  const normalizedForks = normalizeByMax(features.map((item) => item.rawForks7d));
  const normalizedActivity = normalizeByMax(features.map((item) => item.rawActivity));

  return new Map(
    repos.map((repo, index) => {
      const item = features[index];
      const trendScore =
        0.4 * normalized7d[index] +
        0.2 * normalized1d[index] +
        0.15 * normalizedForks[index] +
        0.15 * normalizedActivity[index] +
        0.1 * item.recencyScore;

      return [
        String(repo.repo_id),
        {
          trend_score: round(clamp(trendScore), 1),
          stars_1d: item.stars1d,
          stars_7d: item.stars7d,
          forks_7d: item.forks7d,
          recency_score: round(item.recencyScore, 1),
          source_tags: repo.source_tags || []
        }
      ];
    })
  );
}

function trendFeatures(repo, store, date) {
  const snapshot1d = store.findSnapshotOnOrBefore(repo.repo_id, addDays(date, -1), 2);
  const snapshot7d = store.findSnapshotOnOrBefore(repo.repo_id, addDays(date, -7), 10);
  const stars1d = snapshot1d ? Math.max(0, (repo.stars || 0) - snapshot1d.stars) : null;
  const stars7d = snapshot7d ? Math.max(0, (repo.stars || 0) - snapshot7d.stars) : null;
  const forks7d = snapshot7d ? Math.max(0, (repo.forks || 0) - snapshot7d.forks) : null;
  const trendingBoost = (repo.source_tags || []).some((tag) => tag.startsWith("github_trending")) ? 12 : 0;
  const dailyBoost = (repo.source_tags || []).some((tag) => tag.includes(":daily")) ? 8 : 0;
  const sourceBoost = Math.max(0, (repo.source_tags || []).length - 1) * 3;
  const ageDays = daysBetween(repo.pushed_at, date);
  const recencyScore = clamp(100 - Math.max(0, ageDays) * 3);

  return {
    stars1d,
    stars7d,
    forks7d,
    rawStars1d: stars1d ?? dailyBoost + trendingBoost / 2,
    rawStars7d: stars7d ?? trendingBoost + Math.log10((repo.stars || 0) + 1),
    rawForks7d: forks7d ?? Math.log10((repo.forks || 0) + 1),
    rawActivity: Math.log10((repo.open_issues || 0) + 1) + sourceBoost + recencyScore / 25,
    recencyScore
  };
}
