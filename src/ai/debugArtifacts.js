import { join } from "node:path";
import { writeJsonAtomic } from "../shared/fs.js";

export async function writeAiDebugArtifact({
  enabled = false,
  debugDir = "data/debug-ai",
  repo,
  date,
  profileId,
  attempt = 1,
  retryMode = false,
  input,
  model,
  baseUrl,
  error
}) {
  if (!enabled) return null;

  const failureType = error?.failureType || "http_error";
  const fileName = `${date || "unknown-date"}-${sanitizeFilePart(repo?.full_name || "unknown-repo")}-attempt-${attempt}-${failureType}.json`;
  const artifactPath = join(debugDir, fileName);
  await writeJsonAtomic(artifactPath, {
    created_at: new Date().toISOString(),
    repo: {
      repo_id: repo?.repo_id ?? null,
      full_name: repo?.full_name || ""
    },
    profile_id: profileId || "",
    attempt,
    retry_mode: Boolean(retryMode),
    model: model || "",
    base_url: baseUrl || "",
    failure_type: failureType,
    error: {
      name: error?.name || "",
      message: error?.message || "",
      stack: error?.stack || ""
    },
    input_summary: summarizeInput(input),
    response: {
      status: error?.context?.status ?? null,
      raw_response: truncate(error?.context?.rawResponse || error?.context?.responseBody || "", 80_000),
      message_content: truncate(error?.context?.content || "", 80_000)
    }
  });
  return artifactPath;
}

export function summarizeInput(input = {}) {
  const repo = input.repo || {};
  const trend = input.trend || {};
  const readme = input.documents?.readme_excerpt || "";
  const release = input.documents?.release_excerpt || "";
  return {
    repo: {
      full_name: repo.full_name || "",
      description: repo.description || "",
      language: repo.language || "",
      topics: (repo.topics || []).slice(0, 12),
      stars: repo.stars ?? repo.stargazers_count ?? null,
      forks: repo.forks ?? null,
      pushed_at: repo.pushed_at || "",
      license: repo.license || ""
    },
    trend: {
      trend_score: trend.trend_score ?? null,
      stars_1d: trend.stars_1d ?? null,
      stars_7d: trend.stars_7d ?? null,
      forks_7d: trend.forks_7d ?? null,
      source_tags: (trend.source_tags || []).slice(0, 12)
    },
    documents: {
      readme_excerpt_chars: readme.length,
      release_excerpt_chars: release.length,
      readme_excerpt_preview: truncate(readme, 1600),
      release_excerpt_preview: truncate(release, 1000)
    },
    user_profile: {
      profile_id: input.user_profile?.profile_id || "",
      role: input.user_profile?.role || "",
      preferred_languages: input.user_profile?.preferred_languages || [],
      interested_topics: input.user_profile?.interested_topics || [],
      learning_goals: input.user_profile?.learning_goals || []
    }
  };
}

function sanitizeFilePart(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function truncate(value, maxLength) {
  const text = String(value || "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n...[truncated ${text.length - maxLength} chars]`;
}
