import { GitHubClient } from "./githubClient.js";

const LANGUAGE_SLUGS = {
  "c#": "c%23",
  "c++": "c++",
  javascript: "javascript",
  typescript: "typescript",
  python: "python",
  java: "java",
  go: "go",
  rust: "rust",
  kotlin: "kotlin",
  ruby: "ruby",
  php: "php",
  swift: "swift"
};

export async function collectTrendingCandidates({
  profile,
  client = new GitHubClient(),
  includeLanguages = true,
  logger = console
}) {
  const languages = includeLanguages ? profile.preferred_languages.slice(0, 4) : [];
  const targets = [
    { language: "", since: "daily" },
    { language: "", since: "weekly" },
    ...languages.map((language) => ({ language, since: "daily" }))
  ];

  const candidates = [];
  for (const target of targets) {
    const url = trendingUrl(target.language, target.since);
    try {
      const html = await client.requestText(url, { accept: "text/html" });
      const fullNames = parseTrendingFullNames(html).slice(0, 25);
      for (const fullName of fullNames) {
        const languageTag = target.language ? `:${slugifyLanguage(target.language)}` : "";
        candidates.push({
          full_name: fullName,
          source_tags: [`github_trending:${target.since}${languageTag}`]
        });
      }
    } catch (error) {
      logger.warn?.(`Trending 采集失败 ${url}: ${error.message}`);
    }
  }

  return candidates;
}

export function parseTrendingFullNames(html) {
  const result = [];
  const seen = new Set();
  const regex = /<h2[\s\S]*?<a[^>]+href="\/([^"\/\s]+\/[^"\/\s]+)"[\s\S]*?<\/h2>/gi;
  let match;
  while ((match = regex.exec(html))) {
    const fullName = match[1].replace(/\s/g, "");
    if (!seen.has(fullName.toLowerCase())) {
      seen.add(fullName.toLowerCase());
      result.push(fullName);
    }
  }
  return result;
}

function trendingUrl(language, since) {
  const slug = language ? `/${slugifyLanguage(language)}` : "";
  return `https://github.com/trending${slug}?since=${since}`;
}

function slugifyLanguage(language) {
  const lower = String(language || "").toLowerCase();
  return LANGUAGE_SLUGS[lower] || encodeURIComponent(lower.replace(/\s+/g, "-"));
}
