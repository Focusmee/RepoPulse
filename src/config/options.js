const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateOption(value, name = "date") {
  if (value === undefined || value === null || value === "") return undefined;
  const text = String(value);
  if (!DATE_PATTERN.test(text)) {
    throw new Error(`${name} must use YYYY-MM-DD format`);
  }

  const parsed = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new Error(`${name} must be a valid calendar date`);
  }

  return text;
}

export function parseIntegerOption(value, name, { min = 1, max = Number.MAX_SAFE_INTEGER, defaultValue } = {}) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") {
    throw new Error(`${name} requires a numeric value`);
  }

  const number = Number(value);
  if (!Number.isInteger(number)) {
    throw new Error(`${name} must be an integer`);
  }
  if (number < min || number > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }

  return number;
}

export function parseRunCliOptions(flags) {
  return {
    profilePath: flags.profile || flags.p || "config/profiles/default.json",
    watchlistPath: flags.watchlist || "config/watchlist.json",
    date: parseDateOption(flags.date, "--date"),
    limit: parseIntegerOption(flags.limit, "--limit", { min: 1, max: 100 }),
    maxCandidates: parseIntegerOption(flags["max-candidates"], "--max-candidates", { min: 1, max: 500 }),
    maxAnalyze: parseIntegerOption(flags["max-analyze"], "--max-analyze", { min: 1, max: 200 }),
    maxSearchQueries: parseIntegerOption(flags["max-search-queries"], "--max-search-queries", { min: 0, max: 50 }),
    perSearchQuery: parseIntegerOption(flags["per-search-query"], "--per-search-query", { min: 1, max: 100 }),
    outputPath: flags.output,
    storePath: flags.store,
    noAi: Boolean(flags["no-ai"]),
    includeTrending: !flags["no-trending"],
    dryRun: Boolean(flags["dry-run"])
  };
}
