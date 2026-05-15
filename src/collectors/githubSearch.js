import { isoDaysAgo } from "../shared/date.js";

export function buildSearchQueries(profile, watchlist, { sinceDate = isoDaysAgo(30), maxQueries = 10 } = {}) {
  const queries = [];

  for (const language of profile.preferred_languages.slice(0, 4)) {
    queries.push({
      tag: `search:language:${language}`,
      query: `language:${quoteIfNeeded(language)} pushed:>${sinceDate} stars:>20`
    });
  }

  const topics = [...profile.interested_topics, ...watchlist.topics];
  for (const topic of unique(topics).slice(0, 6)) {
    queries.push({
      tag: `search:topic:${topic}`,
      query: `topic:${quoteIfNeeded(topic)} pushed:>${sinceDate} stars:>10`
    });
  }

  for (const keyword of unique(watchlist.keywords).slice(0, 4)) {
    queries.push({
      tag: `search:keyword:${keyword}`,
      query: `${keyword} in:name,description,readme pushed:>${sinceDate} stars:>5`
    });
  }

  return queries.slice(0, maxQueries);
}

export async function collectSearchCandidates({
  client,
  profile,
  watchlist,
  sinceDate = isoDaysAgo(30),
  perQuery = 12,
  maxQueries = 10,
  logger = console
}) {
  const queries = buildSearchQueries(profile, watchlist, { sinceDate, maxQueries });
  const candidates = [];

  for (const { tag, query } of queries) {
    try {
      const repos = await client.searchRepositories(query, { perPage: perQuery, sort: "stars" });
      for (const repo of repos) {
        candidates.push({
          ...repo,
          source_tags: [...(repo.source_tags || []), tag]
        });
      }
    } catch (error) {
      logger.warn?.(`Search 采集失败 ${tag}: ${error.message}`);
      if (String(error.message).toLowerCase().includes("rate limit")) break;
    }
  }

  return candidates;
}

export async function collectWatchlistRepos({ client, watchlist, logger = console }) {
  const candidates = [];
  for (const fullName of watchlist.repos || []) {
    try {
      candidates.push(await client.getRepo(fullName, ["watchlist:repo"]));
    } catch (error) {
      logger.warn?.(`Watchlist 仓库采集失败 ${fullName}: ${error.message}`);
    }
  }
  return candidates.filter(Boolean);
}

function quoteIfNeeded(value) {
  const text = String(value);
  return /\s/.test(text) ? `"${text}"` : text;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
