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

test("profile normalization preserves SBTI metadata as read-only fields", () => {
  const profile = normalizeProfile({
    profile_id: "sbti-example",
    persona_type: "SBTI",
    persona_code: "SBTI",
    persona_raw_code: "SBPI",
    persona_name: "火速开搞型",
    industry_tags: ["developer_tools"],
    expertise_level: "intermediate",
    raw_time_budget: "half_day",
    tech_stack_friction: "prefer_low_setup",
    current_pain_points: ["cant_run_locally"],
    preferred_project_traits: ["clear_quickstart"],
    avoid_project_traits: ["heavy_setup_without_demo"],
    report_explanation_style: "action_first",
    recommendationWeights: { demo_friendliness: 1.5 },
    persona_metadata: { source: "sbti", raw_code: "SBPI" }
  });

  assert.equal(profile.persona_type, "SBTI");
  assert.equal(profile.persona_code, "SBTI");
  assert.equal(profile.persona_raw_code, "SBPI");
  assert.equal(profile.persona_name, "火速开搞型");
  assert.deepEqual(profile.industry_tags, ["developer_tools"]);
  assert.deepEqual(profile.current_pain_points, ["cant_run_locally"]);
  assert.deepEqual(profile.preferred_project_traits, ["clear_quickstart"]);
  assert.deepEqual(profile.avoid_project_traits, ["heavy_setup_without_demo"]);
  assert.deepEqual(profile.recommendationWeights, { demo_friendliness: 1.5 });
  assert.deepEqual(profile.persona_metadata, { source: "sbti", raw_code: "SBPI" });
});
