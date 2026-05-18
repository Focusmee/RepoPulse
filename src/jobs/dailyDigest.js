import { dirname, join } from "node:path";
import { GitHubClient } from "../collectors/githubClient.js";
import { collectCandidates } from "../collectors/index.js";
import { loadProfile, loadWatchlist } from "../config/profile.js";
import { getRuntimeConfig } from "../config/env.js";
import { parseDateOption, parseIntegerOption } from "../config/options.js";
import { DEFAULT_DOCUMENT_TTL_HOURS, shouldReuseDocument } from "../documents/cachePolicy.js";
import { fetchRepoDocuments } from "../documents/readmeFetcher.js";
import { analyzeRepo } from "../ai/analyzer.js";
import { preselectRepos } from "../rankers/preselector.js";
import { rankAnalyzedRepos } from "../rankers/personalizedRanker.js";
import { renderMarkdownReport } from "../reports/renderMarkdown.js";
import { checkReportQuality } from "../reports/qualityCheck.js";
import { buildSnapshots, calculateTrendScores } from "../scorers/trendScorer.js";
import { mapLimit } from "../shared/async.js";
import { addDays, todayString } from "../shared/date.js";
import { ensureDir, writeText } from "../shared/fs.js";
import { stableHash } from "../shared/text.js";
import { JsonStore } from "../store/jsonStore.js";

const ANALYSIS_CACHE_VERSION = "ai-debug-recovery-v1";

export async function runDailyDigest(options = {}) {
  const runtimeConfig = options.runtimeConfig || getRuntimeConfig();
  const date = parseDateOption(options.date, "date") || todayString(runtimeConfig.timeZone);
  const profile = await loadProfile(options.profilePath);
  const watchlist = await loadWatchlist(options.watchlistPath);
  const store = options.store || (await new JsonStore(options.storePath || runtimeConfig.storePath).load());
  const client = options.client || new GitHubClient({ token: runtimeConfig.githubToken, timeoutMs: runtimeConfig.githubTimeoutMs });
  const logger = options.logger || console;

  const maxCandidates = parseIntegerOption(options.maxCandidates, "maxCandidates", { min: 1, max: 500, defaultValue: 80 });
  const maxSearchQueries = parseIntegerOption(options.maxSearchQueries, "maxSearchQueries", {
    min: 0,
    max: 50,
    defaultValue: runtimeConfig.githubToken ? 10 : 4
  });
  const perSearchQuery = parseIntegerOption(options.perSearchQuery, "perSearchQuery", { min: 1, max: 100, defaultValue: 12 });
  const maxAnalyze = parseIntegerOption(options.maxAnalyze, "maxAnalyze", { min: 1, max: 200, defaultValue: 20 });
  const limit = parseIntegerOption(options.limit, "limit", { min: 1, max: 100, defaultValue: profile.daily_limit || 10 });
  const concurrency = parseIntegerOption(options.concurrency, "concurrency", { min: 1, max: 20, defaultValue: 3 });
  const documentTtlHours = parseIntegerOption(options.documentTtlHours, "documentTtlHours", {
    min: 1,
    max: 720,
    defaultValue: DEFAULT_DOCUMENT_TTL_HOURS
  });

  const collectCandidatesFn = options.collectCandidatesFn || collectCandidates;
  const analyzeRepoFn = options.analyzeRepoFn || analyzeRepo;

  logger.info(`RepoPulse start: date=${date}, profile=${profile.profile_id}`);

  const candidates = await collectCandidatesFn({
    client,
    profile,
    watchlist,
    maxCandidates,
    maxSearchQueries,
    perSearchQuery,
    sinceDate: addDays(date, -30),
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
  const analyzeLimit = Math.min(maxAnalyze, repos.length);
  const preselected = preselectRepos({ repos, trends, profile, limit: analyzeLimit });

  logger.info(`RepoPulse candidates=${repos.length}, preselected=${preselected.length}`);

  const analysisResult = await analyzePreselectedRepos({
    preselected,
    trends,
    client,
    store,
    logger,
    profile,
    runtimeConfig,
    date,
    concurrency,
    documentTtlHours,
    noAi: Boolean(options.noAi),
    analyzeRepoFn
  });

  const recentRepoIds = store.getRecentReportRepoIds(profile.profile_id, date, 7);
  const ranked = rankAnalyzedRepos({
    repos: preselected,
    analyses: analysisResult.analyses,
    analysisMeta: analysisResult.analysisMeta,
    trends,
    profile,
    recentRepoIds,
    referenceDate: date,
    limit,
    documents: new Map(preselected.map((repo) => [String(repo.repo_id), store.getDocument(repo.repo_id)]))
  });

  const stats = {
    candidate_count: repos.length,
    analysis_attempted_count: preselected.length,
    analyzed_count: analysisResult.analyses.size,
    analysis_failed_count: analysisResult.failures.length,
    recommended_count: ranked.items.length,
    readme_success_rate: preselected.length ? Math.round((analysisResult.readmeSuccess / preselected.length) * 100) : 0,
    analysis_success_rate: preselected.length ? Math.round((analysisResult.analyses.size / preselected.length) * 100) : 0,
    ai_provider_summary: formatProviderCounts(analysisResult.providerCounts),
    ai_success_count: analysisResult.aiSuccessCount,
    heuristic_fallback_count: analysisResult.heuristicFallbackCount,
    ai_failure_type_summary: formatProviderCounts(analysisResult.aiFailureTypeCounts),
    failed_repos: analysisResult.failures
  };

  const quality = checkReportQuality({ ranked });
  stats.quality_warning_count = quality.warning_count;
  stats.quality_warnings = quality.warnings;
  for (const warning of quality.warnings) {
    logger.warn?.(`RepoPulse quality ${warning.level} ${warning.repo || "report"}: ${warning.message}`);
  }

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

  logger.info(`RepoPulse report generated: ${reportPath}`);
  return {
    date,
    profile,
    reportPath,
    markdown,
    stats,
    ranked
  };
}

export async function analyzePreselectedRepos({
  preselected,
  trends,
  client,
  store,
  logger = console,
  profile,
  runtimeConfig,
  date,
  concurrency = 3,
  documentTtlHours = DEFAULT_DOCUMENT_TTL_HOURS,
  noAi = false,
  analyzeRepoFn = analyzeRepo
}) {
  let readmeSuccess = 0;
  const providerCounts = new Map();
  const aiFailureTypeCounts = new Map();
  const analysisMeta = new Map();
  const analyses = new Map();
  const failures = [];

  await mapLimit(preselected, concurrency, async (repo) => {
    try {
      const document = await fetchOrReuseDocument({ client, repo, store, logger, documentTtlHours });
      if (document.readme_status === "ok") readmeSuccess += 1;

      const trend = trends.get(String(repo.repo_id)) || { trend_score: 0, source_tags: repo.source_tags || [] };
      const analysisMode = noAi ? "heuristic" : runtimeConfig.openaiModel || "heuristic";
      const inputHash = stableHash(
        `${ANALYSIS_CACHE_VERSION}:${document.document_hash}:${JSON.stringify(profile)}:${JSON.stringify(trend)}:${analysisMode}`
      );
      const cachedAnalysis = store.getAnalysis(repo.repo_id, date, profile.profile_id);

      if (cachedAnalysis?.validation_status === "ok" && cachedAnalysis.input_hash === inputHash && cachedAnalysis.structured_json) {
        providerCounts.set("cache", (providerCounts.get("cache") || 0) + 1);
        analyses.set(String(repo.repo_id), cachedAnalysis.structured_json);
        const meta = {
          provider: cachedAnalysis.provider || "cache",
          model: cachedAnalysis.model || "",
          source: "cache",
          ai_failure_type: cachedAnalysis.ai_failure_type || "",
          ai_error: cachedAnalysis.ai_error || "",
          ai_attempts: Number(cachedAnalysis.ai_attempts || 0),
          ai_debug_artifacts: cachedAnalysis.ai_debug_artifacts || []
        };
        analysisMeta.set(String(repo.repo_id), meta);
        if (meta.ai_failure_type) incrementMap(aiFailureTypeCounts, meta.ai_failure_type);
        return;
      }

      const { provider, analysis, aiFailure = null, attempts = 1 } = await analyzeRepoFn({
        repo,
        trend,
        documents: document,
        profile,
        runtimeConfig,
        noAi,
        referenceDate: date,
        logger
      });

      providerCounts.set(provider, (providerCounts.get(provider) || 0) + 1);
      analyses.set(String(repo.repo_id), analysis);
      const meta = {
        provider,
        model: provider === "openai" ? runtimeConfig.openaiModel : "heuristic",
        source: "fresh",
        ai_failure_type: aiFailure?.type || "",
        ai_error: aiFailure?.message || "",
        ai_attempts: aiFailure?.attempts || attempts,
        ai_debug_artifacts: aiFailure?.debug_artifacts || []
      };
      analysisMeta.set(String(repo.repo_id), meta);
      if (meta.ai_failure_type) incrementMap(aiFailureTypeCounts, meta.ai_failure_type);
      store.upsertAnalysis({
        repo_id: repo.repo_id,
        full_name: repo.full_name,
        analysis_date: date,
        profile_id: profile.profile_id,
        provider,
        model: provider === "openai" ? runtimeConfig.openaiModel : "heuristic",
        analysis_cache_version: ANALYSIS_CACHE_VERSION,
        input_hash: inputHash,
        structured_json: analysis,
        ai_failure_type: meta.ai_failure_type,
        ai_error: meta.ai_error,
        ai_attempts: meta.ai_attempts,
        ai_debug_artifacts: meta.ai_debug_artifacts,
        confidence: analysis.confidence?.score || 0,
        validation_status: "ok",
        created_at: new Date().toISOString()
      });
    } catch (error) {
      failures.push({
        repo_id: repo.repo_id,
        full_name: repo.full_name,
        error: error.message
      });
      logger.warn?.(`Repo analysis failed ${repo.full_name}: ${error.message}`);
    }
  });

  return {
    readmeSuccess,
    providerCounts,
    aiFailureTypeCounts,
    analysisMeta,
    aiSuccessCount: countAnalysisMeta(analysisMeta, (meta) => meta.provider === "openai"),
    heuristicFallbackCount: countAnalysisMeta(analysisMeta, (meta) => meta.provider === "heuristic" && meta.ai_failure_type),
    analyses,
    failures
  };
}

async function fetchOrReuseDocument({ client, repo, store, logger, documentTtlHours = DEFAULT_DOCUMENT_TTL_HOURS }) {
  const existing = store.getDocument(repo.repo_id);
  if (shouldReuseDocument(existing, repo, { ttlHours: documentTtlHours })) {
    return existing;
  }
  const document = await fetchRepoDocuments({ client, repo, logger });
  store.upsertDocument(document);
  return document;
}

function formatProviderCounts(providerCounts) {
  if (providerCounts.size === 0) return "none";
  return Array.from(providerCounts.entries())
    .map(([provider, count]) => `${provider} ${count}`)
    .join("; ");
}

function incrementMap(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function countAnalysisMeta(analysisMeta, predicate) {
  let count = 0;
  for (const meta of analysisMeta.values()) {
    if (predicate(meta)) count += 1;
  }
  return count;
}
