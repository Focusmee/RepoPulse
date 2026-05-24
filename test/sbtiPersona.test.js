import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SAMPLE_SBTI_ANSWERS,
  adaptRecommendationWeights,
  buildProfileFromSbti,
  generateSbtiProfile,
  getSbtiTypes,
  renderPersonaResultHtml,
  renderPersonaResult,
  scoreSbtiAnswers
} from "../src/persona/index.js";
import { normalizeProfile } from "../src/config/profile.js";

const SHOWCASE_EXPECTATIONS = Object.freeze([
  ["examples/sbti/sbti.answers.json", "SBTI", "火速开搞型"],
  ["examples/sbti/smpc.answers.json", "SMPC", "产品化雷达型"],
  ["examples/sbti/rbpc.answers.json", "RBPC", "稳健落地派"]
]);

test("sample answers generate the SBTI quick shipper persona", () => {
  const result = generateSbtiProfile({ answers: SAMPLE_SBTI_ANSWERS });

  assert.equal(result.sbtiResult.rawCode, "SBTI");
  assert.equal(result.sbtiResult.personaCode, "SBTI");
  assert.equal(result.sbtiResult.sbtiType.name, "火速开搞型");
  assert.equal(result.profile.profile_id, "sbti-sbti-developer-tools-half-day");
  assert.deepEqual(result.profile.preferred_languages, []);
  assert.ok(result.profile.interested_topics.includes("developer-tools"));
  assert.ok(result.profile.preferred_project_traits.includes("clear_quickstart"));
});

for (const [path, expectedCode, expectedName] of SHOWCASE_EXPECTATIONS) {
  test(`showcase answers generate ${expectedCode} profile`, () => {
    const payload = JSON.parse(readFileSync(path, "utf8"));
    const result = generateSbtiProfile({ answers: payload.answers });

    assert.equal(result.sbtiResult.personaCode, expectedCode);
    assert.equal(result.sbtiResult.personaName, expectedName);
    assert.equal(result.profile.persona_code, expectedCode);
    assert.equal(result.profile.persona_name, expectedName);
    assert.deepEqual(result.profile.preferred_languages, []);
    assert.ok(Array.isArray(result.profile.interested_topics));
    assert.ok(result.profile.interested_topics.length > 0);
    assert.ok(result.profile.profile_id.startsWith(`sbti-${result.sbtiResult.rawCode.toLowerCase()}`));
    assert.ok(result.profile.persona_metadata);
    assert.ok(result.profile.recommendationWeights);
  });
}

test("trend observer uses the valid RMTI code", () => {
  const result = scoreSbtiAnswers({
    q1: "B",
    q2: "B",
    q3: "A",
    q4: "A",
    q5: "general_ai_apps",
    q6: "trend_tracking",
    q7: "thirty_minutes",
    q8: "dont_know_worth"
  });

  assert.equal(result.rawCode, "RMTI");
  assert.equal(result.personaCode, "RMTI");
  assert.equal(result.sbtiType.name, "趋势观察员型");
});

test("non-core codes resolve through explicit aliases", () => {
  const result = scoreSbtiAnswers({
    q1: "B",
    q2: "B",
    q3: "B",
    q4: "B",
    q5: "enterprise_workflow",
    q6: "work_automation",
    q7: "two_three_days",
    q8: "cant_run_locally"
  });

  assert.equal(result.rawCode, "RMPC");
  assert.equal(result.personaCode, "SMPC");
  assert.equal(result.resolvedBy, "alias");
});

test("core type config covers all 16 answer combinations through direct codes or aliases", () => {
  const coveredCodes = new Set();
  for (const type of getSbtiTypes()) {
    coveredCodes.add(type.code);
    for (const alias of type.aliases) coveredCodes.add(alias);
  }

  for (const action of ["S", "R"]) {
    for (const build of ["B", "M"]) {
      for (const value of ["T", "P"]) {
        for (const target of ["I", "C"]) {
          assert.ok(coveredCodes.has(`${action}${build}${value}${target}`), `missing SBTI coverage for ${action}${build}${value}${target}`);
        }
      }
    }
  }
});

test("invalid answers fail with a clear error", () => {
  assert.throws(
    () =>
      scoreSbtiAnswers({
        ...SAMPLE_SBTI_ANSWERS,
        q7: "forever"
      }),
    /非法 SBTI 答案：q7=forever/
  );

  assert.throws(
    () =>
      scoreSbtiAnswers({
        ...SAMPLE_SBTI_ANSWERS,
        q8: ""
      }),
    /缺少 SBTI 答案：q8/
  );
});

test("generated profile is compatible with existing profile normalization", () => {
  const sbtiResult = scoreSbtiAnswers(SAMPLE_SBTI_ANSWERS);
  const profile = buildProfileFromSbti({ sbtiResult });
  const normalized = normalizeProfile(profile, "config/profiles/sbti-generated.json");

  assert.equal(normalized.profile_id, profile.profile_id);
  assert.deepEqual(normalized.preferred_languages, []);
  assert.equal(normalized.time_budget, "weekend");
  assert.equal(normalized.skill_level, "intermediate");
  assert.deepEqual(normalized.goal_priority, ["ship_demo", "follow_trend"]);
});

test("persona result model is stable for future UI or image generation", () => {
  const sbtiResult = scoreSbtiAnswers(SAMPLE_SBTI_ANSWERS);
  const profile = buildProfileFromSbti({ sbtiResult });
  const viewModel = renderPersonaResult({ sbtiResult, profile });

  assert.equal(viewModel.headline, "你是 SBTI / 火速开搞型");
  assert.equal(viewModel.personaCode, "SBTI");
  assert.equal(viewModel.profileSummary.industry, "开发者工具");
  assert.ok(viewModel.visualPrompt.includes("AI 开发者"));
  assert.ok(viewModel.recommendationStrategy.length >= 3);
});

test("persona result HTML escapes untrusted display text", () => {
  const html = renderPersonaResultHtml({
    headline: "你是 <script>alert(1)</script>",
    subheadline: "\"收藏\" & <跑起来>",
    seriousDescription: "认真 <描述>",
    profileSummary: {
      industry: "AI <tools>",
      goal: "demo",
      timeBudget: "half_day",
      painPoint: "cant_run_locally"
    },
    recommendationStrategy: ["先跑 <demo>"],
    dailyReportIntro: "今天 & 明天"
  });

  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(html.includes("&quot;收藏&quot; &amp; &lt;跑起来&gt;"));
});

test("recommendation weight adapter exposes explanation hints without ranking side effects", () => {
  const adapted = adaptRecommendationWeights({
    demo_friendliness: 1.5,
    setup_cost_penalty: 1.3,
    architecture_clarity: 0.9,
    ignored: "bad"
  });

  assert.deepEqual(adapted.experimental_ranking_adjustments, {
    demo_friendliness: 1.5,
    setup_cost_penalty: 1.3,
    architecture_clarity: 0.9
  });
  assert.deepEqual(
    adapted.explanation_hints.map((hint) => hint.id),
    ["demo_friendliness", "setup_cost_penalty"]
  );
});
