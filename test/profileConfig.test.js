import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProfile } from "../src/config/profile.js";

test("profile normalization fills P3 defaults for legacy profiles", () => {
  const profile = normalizeProfile({
    profile_id: "legacy",
    preferred_languages: "TypeScript",
    interested_topics: ["agent"],
    learning_goals: ["做应用"],
    daily_limit: 5
  });

  assert.equal(profile.skill_level, "intermediate");
  assert.equal(profile.time_budget, "weekend");
  assert.equal(profile.preferred_project_size, "medium");
  assert.deepEqual(profile.known_stack, []);
  assert.deepEqual(profile.weak_areas, []);
  assert.deepEqual(profile.goal_priority, ["learn_architecture", "ship_demo"]);
});

test("profile normalization sanitizes P3 enum fields and aliases", () => {
  const profile = normalizeProfile({
    profileId: "alias",
    skillLevel: "expert",
    knownStack: ["TypeScript", " Docker "],
    weakAreas: "Kubernetes",
    timeBudget: "deep-study",
    preferredProjectSize: "huge",
    goalPriority: ["ship_demo", "unknown", "resume_project", "ship_demo"]
  });

  assert.equal(profile.skill_level, "intermediate");
  assert.equal(profile.time_budget, "deep-study");
  assert.equal(profile.preferred_project_size, "medium");
  assert.deepEqual(profile.known_stack, ["TypeScript", "Docker"]);
  assert.deepEqual(profile.weak_areas, ["Kubernetes"]);
  assert.deepEqual(profile.goal_priority, ["ship_demo", "resume_project"]);
});
