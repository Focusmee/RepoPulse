import { dirname, join } from "node:path";
import { GitHubClient } from "../collectors/githubClient.js";
import { collectCandidates } from "../collectors/index.js";
import { loadProfile, loadWatchlist } from "../config/profile.js";
import { getRuntimeConfig } from "../config/env.js";
import { fetchRepoDocuments } from "../documents/readmeFetcher.js";
import { analyzeRepo } from "../ai/analyzer.js";
import { rankAnalyzedRepos } from "../rankers/personalizedRanker.js";
import { renderMarkdownReport } from "../reports/renderMarkdown.js";
import { buildSnapshots, calculateTrendScores } from "../scorers/trendScorer.js";
import { mapLimit } from "../shared/async.js";
import { todayString } from "../shared/date.js";
import { ensureDir, writeText } from "../shared/fs.js";
import { stableHash } from "../shared/text.js";
import { JsonStore } from "../store/jsonStore.js";

export async function runDailyDigest(options = {}) {
  const runtimeConfig = getRuntimeConfig();
  const date = options.date || todayString(runtimeConfig.timeZone);
  const profile = await loadProfile(options.profilePath);
  const watchlist = await loadWatchlist(options.watchlistPath);
  const store = await new JsonStore(options.storePath || runtimeConfig.storePath).load();
  const client = new GitHubClient({ token: runtimeConfig.githubToken });
  const logger = options.logger || console;

  logger.info(`RepoPulse 开始生成日报：date=${date}, profile=${profile.profile_id}`);

  const candidates = await collectCandidates({
    client,
    profile,
    watchlist,
    maxCandidates: Number(options.maxCandidates || 80),
    maxSearchQueries: Number(options.maxSearchQueries || (runtimeConfig.githubToken ? 10 : 4)),
    perSearchQuery: Number(options.perSearchQuery || 12),
    includeTrending: options.includeTrending !== false,
    logger
  });

  const usableRepos = candidates.filter((repo) => !repo.private && !repo.disabled);
  const repos = store.upsertRepos(
    usableRepos.map((repo) => ({
      ...repo,
      first_seen_at: store.data.repos[String(repo.repo_id)]?.first_seen_at || new Date().toISOString()
    }))
  );

  for (const snapshot of buildSnapshots(repos, date)) {
    store.upsertSnapshot(snapshot);
  }

  const trends = calculateTrendScores(repos, store, date);
  const analyzeLimit = Math.min(Number(options.maxAnalyze || 20), repos.length);
  const preselected = repos
    .slice()
    .sort((a, b) => (trends.get(String(b.repo_id))?.trend_score || 0) - (trends.get(String(a.repo_id))?.trend_score || 0))
    .slice(0, analyzeLimit);

  logger.info(`候选项目 ${repos.length} 个，进入分析 ${preselected.length} 个`);

  let readmeSuccess = 0;
  const providerCounts = new Map();
  const analyses = new Map();

  await mapLimit(preselected, Number(options.concurrency || 3), async (repo) => {
    const document = await fetchOrReuseDocument({ client, repo, store, logger });
    if (document.readme_status === "ok") readmeSuccess += 1;
    const trend = trends.get(String(repo.repo_id)) || { trend_score: 0, source_tags: repo.source_tags || [] };
    const { provider, analysis } = await analyzeRepo({
      repo,
      trend,
      documents: document,
      profile,
      runtimeConfig,
      noAi: Boolean(options.noAi),
      logger
    });
    providerCounts.set(provider, (providerCounts.get(provider) || 0) + 1);
    analyses.set(String(repo.repo_id), analysis);
    store.upsertAnalysis({
      repo_id: repo.repo_id,
      full_name: repo.full_name,
      analysis_date: date,
      profile_id: profile.profile_id,
      provider,
      model: provider === "openai" ? runtimeConfig.openaiModel : "heuristic",
      input_hash: stableHash(`${document.document_hash}:${JSON.stringify(profile)}:${JSON.stringify(trend)}`),
      structured_json: analysis,
      confidence: analysis.confidence?.score || 0,
      validation_status: "ok",
      created_at: new Date().toISOString()
    });
  });

  const recentRepoIds = store.getRecentReportRepoIds(profile.profile_id, date, 7);
  const ranked = rankAnalyzedRepos({
    repos: preselected,
    analyses,
    trends,
    profile,
    recentRepoIds,
    limit: Number(options.limit || profile.daily_limit || 10)
  });

  const stats = {
    candidate_count: repos.length,
    analyzed_count: preselected.length,
    recommended_count: ranked.items.length,
    readme_success_rate: preselected.length ? Math.round((readmeSuccess / preselected.length) * 100) : 0,
    ai_provider_summary: formatProviderCounts(providerCounts)
  };

  const markdown = renderMarkdownReport({ date, profile, ranked, stats });
  const reportPath = options.outputPath || join("reports", date.slice(0, 4), `${date}-${profile.profile_id}.md`);

  if (!options.dryRun) {
    await ensureDir(dirname(reportPath));
    await writeText(reportPath, markdown);
    store.upsertReport({
      report_date: date,
      profile_id: profile.profile_id,
      markdown,
      items_json: ranked.items,
      generated_at: new Date().toISOString(),
      delivery_status: "generated",
      stats
    });
    await store.save();
  }

  logger.info(`日报已生成：${reportPath}`);
  return {
    date,
    profile,
    reportPath,
    markdown,
    stats,
    ranked
  };
}

async function fetchOrReuseDocument({ client, repo, store, logger }) {
  const existing = store.getDocument(repo.repo_id);
  if (existing?.readme_text && existing?.last_fetched_at) {
    return existing;
  }
  const document = await fetchRepoDocuments({ client, repo, logger });
  store.upsertDocument(document);
  return document;
}

function formatProviderCounts(providerCounts) {
  if (providerCounts.size === 0) return "无";
  return Array.from(providerCounts.entries())
    .map(([provider, count]) => `${provider} ${count}`)
    .join("，");
}
