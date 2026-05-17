import { mapLimit } from "../shared/async.js";
import { mergeCandidates } from "./normalize.js";
import { collectSearchCandidates, collectWatchlistRepos } from "./githubSearch.js";
import { collectTrendingCandidates } from "./githubTrending.js";

export async function collectCandidates({
  client,
  profile,
  watchlist,
  maxCandidates = 80,
  maxSearchQueries = 10,
  perSearchQuery = 12,
  sinceDate,
  includeTrending = true,
  logger = console
}) {
  const [trendingCandidates, searchCandidates, watchlistCandidates] = await Promise.all([
    includeTrending ? collectTrendingCandidates({ client, profile, logger }) : [],
    collectSearchCandidates({ client, profile, watchlist, logger, sinceDate, maxQueries: maxSearchQueries, perQuery: perSearchQuery }),
    collectWatchlistRepos({ client, watchlist, logger })
  ]);

  const merged = mergeCandidates([...trendingCandidates, ...searchCandidates, ...watchlistCandidates]);
  const hydrated = await hydrateMissingMetadata({ client, candidates: merged.slice(0, maxCandidates), logger });
  return mergeCandidates(hydrated).slice(0, maxCandidates);
}

async function hydrateMissingMetadata({ client, candidates, logger }) {
  return mapLimit(candidates, 4, async (candidate) => {
    if (candidate.repo_id && candidate.stars !== undefined) return candidate;
    try {
      const repo = await client.getRepo(candidate.full_name, candidate.source_tags || []);
      return {
        ...repo,
        source_tags: [...(repo.source_tags || []), ...(candidate.source_tags || [])]
      };
    } catch (error) {
      logger.warn?.(`仓库元数据获取失败 ${candidate.full_name}: ${error.message}`);
      return null;
    }
  }).then((items) => items.filter(Boolean));
}
