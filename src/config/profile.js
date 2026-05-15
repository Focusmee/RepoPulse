import { basename, resolve } from "node:path";
import { readdir } from "node:fs/promises";
import { readJson } from "../shared/fs.js";

const DEFAULT_PROFILE_PATH = "config/profiles/default.json";

export function normalizeProfile(rawProfile = {}, sourcePath = DEFAULT_PROFILE_PATH) {
  const profileId =
    rawProfile.profile_id ||
    rawProfile.profileId ||
    basename(sourcePath, ".json").replace(/\s+/g, "-").toLowerCase();

  return {
    profile_id: profileId,
    role: rawProfile.role || "开发者",
    preferred_languages: toStringArray(rawProfile.preferred_languages || rawProfile.preferredLanguages),
    interested_topics: toStringArray(rawProfile.interested_topics || rawProfile.interestedTopics),
    learning_goals: toStringArray(rawProfile.learning_goals || rawProfile.learningGoals),
    excluded_topics: toStringArray(rawProfile.excluded_topics || rawProfile.excludedTopics),
    daily_limit: Number(rawProfile.daily_limit || rawProfile.dailyLimit || 10)
  };
}

export async function loadProfile(profilePath = DEFAULT_PROFILE_PATH) {
  const absolutePath = resolve(profilePath);
  const rawProfile = await readJson(absolutePath, null);
  if (!rawProfile) {
    throw new Error(`找不到用户画像配置：${absolutePath}`);
  }
  return normalizeProfile(rawProfile, absolutePath);
}

export async function loadWatchlist(path = "config/watchlist.json") {
  const watchlist = await readJson(resolve(path), {});
  return {
    topics: toStringArray(watchlist.topics),
    keywords: toStringArray(watchlist.keywords),
    repos: toStringArray(watchlist.repos)
  };
}

export async function listProfiles(dir = "config/profiles") {
  const absoluteDir = resolve(dir);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => ({
      id: basename(entry.name, ".json"),
      path: resolve(absoluteDir, entry.name)
    }));
}

function toStringArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return [String(value).trim()].filter(Boolean);
}
