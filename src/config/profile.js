import { basename, resolve } from "node:path";
import { readdir } from "node:fs/promises";
import { readJson } from "../shared/fs.js";

const DEFAULT_PROFILE_PATH = "config/profiles/default.json";
const SKILL_LEVELS = new Set(["junior", "intermediate", "senior"]);
const TIME_BUDGETS = new Set(["quick-scan", "weekend", "deep-study"]);
const PROJECT_SIZES = new Set(["small", "medium", "large"]);
const GOAL_PRIORITIES = new Set(["resume_project", "learn_architecture", "ship_demo", "follow_trend"]);

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
    skill_level: normalizeEnum(rawProfile.skill_level || rawProfile.skillLevel, SKILL_LEVELS, "intermediate"),
    known_stack: toStringArray(rawProfile.known_stack || rawProfile.knownStack),
    weak_areas: toStringArray(rawProfile.weak_areas || rawProfile.weakAreas),
    time_budget: normalizeEnum(rawProfile.time_budget || rawProfile.timeBudget, TIME_BUDGETS, "weekend"),
    preferred_project_size: normalizeEnum(
      rawProfile.preferred_project_size || rawProfile.preferredProjectSize,
      PROJECT_SIZES,
      "medium"
    ),
    goal_priority: normalizeGoalPriority(rawProfile.goal_priority || rawProfile.goalPriority),
    persona_type: stringOrEmpty(rawProfile.persona_type || rawProfile.personaType),
    persona_code: stringOrEmpty(rawProfile.persona_code || rawProfile.personaCode),
    persona_raw_code: stringOrEmpty(rawProfile.persona_raw_code || rawProfile.personaRawCode),
    persona_name: stringOrEmpty(rawProfile.persona_name || rawProfile.personaName),
    industry_tags: toStringArray(rawProfile.industry_tags || rawProfile.industryTags),
    expertise_level: stringOrEmpty(rawProfile.expertise_level || rawProfile.expertiseLevel),
    raw_time_budget: stringOrEmpty(rawProfile.raw_time_budget || rawProfile.rawTimeBudget),
    tech_stack_friction: stringOrEmpty(rawProfile.tech_stack_friction || rawProfile.techStackFriction),
    current_pain_points: toStringArray(rawProfile.current_pain_points || rawProfile.currentPainPoints),
    preferred_project_traits: toStringArray(rawProfile.preferred_project_traits || rawProfile.preferredProjectTraits),
    avoid_project_traits: toStringArray(rawProfile.avoid_project_traits || rawProfile.avoidProjectTraits),
    report_explanation_style: stringOrEmpty(rawProfile.report_explanation_style || rawProfile.reportExplanationStyle),
    recommendationWeights: normalizeObject(rawProfile.recommendationWeights || rawProfile.recommendation_weights),
    persona_metadata: normalizeObject(rawProfile.persona_metadata || rawProfile.personaMetadata),
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

function normalizeEnum(value, allowed, fallback) {
  const normalized = String(value || "").trim().toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
}

function stringOrEmpty(value) {
  return String(value || "").trim();
}

function normalizeObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...value };
}

function normalizeGoalPriority(value) {
  const values = toStringArray(value)
    .map((item) => item.toLowerCase())
    .filter((item) => GOAL_PRIORITIES.has(item));
  return values.length ? Array.from(new Set(values)) : ["learn_architecture", "ship_demo"];
}
