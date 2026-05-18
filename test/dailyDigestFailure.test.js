import test from "node:test";
import assert from "node:assert/strict";
import { analyzePreselectedRepos } from "../src/jobs/dailyDigest.js";
import { stableHash } from "../src/shared/text.js";

test("single repo analysis failure is recorded without failing the batch", async () => {
  const store = new MemoryStore();
  const repos = [
    { repo_id: 1, full_name: "demo/good", source_tags: [], pushed_at: "2026-05-18" },
    { repo_id: 2, full_name: "demo/bad", source_tags: [], pushed_at: "2026-05-18" }
  ];
  const result = await analyzePreselectedRepos({
    preselected: repos,
    trends: new Map([
      ["1", { trend_score: 20, source_tags: [] }],
      ["2", { trend_score: 20, source_tags: [] }]
    ]),
    client: {
      async getReadme(fullName) {
        return `# ${fullName}`;
      },
      async getLatestRelease() {
        return null;
      }
    },
    store,
    logger: { warn() {} },
    profile: { profile_id: "test" },
    runtimeConfig: { openaiModel: "" },
    date: "2026-05-18",
    concurrency: 2,
    noAi: true,
    analyzeRepoFn: async ({ repo }) => {
      if (repo.repo_id === 2) throw new Error("boom");
      return {
        provider: "heuristic",
        analysis: {
          summary: "ok",
          learning_value: { score: 70 },
          profile_fit: { score: 70 },
          confidence: { score: 80 },
          risks: []
        }
      };
    }
  });

  assert.equal(result.analyses.size, 1);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].full_name, "demo/bad");
});

test("AI fallback metadata is counted and attached to analysis results", async () => {
  const store = new MemoryStore();
  const repos = [{ repo_id: 1, full_name: "demo/fallback", source_tags: [], pushed_at: "2026-05-18" }];
  const result = await analyzePreselectedRepos({
    preselected: repos,
    trends: new Map([["1", { trend_score: 20, source_tags: [] }]]),
    client: {
      async getReadme(fullName) {
        return `# ${fullName}`;
      },
      async getLatestRelease() {
        return null;
      }
    },
    store,
    logger: { warn() {} },
    profile: { profile_id: "test" },
    runtimeConfig: { openaiModel: "test-model" },
    date: "2026-05-18",
    concurrency: 1,
    analyzeRepoFn: async () => ({
      provider: "heuristic",
      analysis: { summary: "ok", learning_value: { score: 70 }, profile_fit: { score: 70 }, confidence: { score: 80 } },
      aiFailure: {
        type: "parse_error",
        message: "bad json",
        attempts: 2,
        debug_artifacts: ["data/debug-ai/demo.json"]
      }
    })
  });

  assert.equal(result.heuristicFallbackCount, 1);
  assert.equal(result.aiSuccessCount, 0);
  assert.equal(result.aiFailureTypeCounts.get("parse_error"), 1);
  assert.equal(result.analysisMeta.get("1").ai_failure_type, "parse_error");
  assert.equal(store.getAnalysis(1, "2026-05-18", "test").ai_attempts, 2);
});

test("analysis cache version prevents reusing old non-diagnostic heuristic results", async () => {
  const store = new MemoryStore();
  const repo = { repo_id: 1, full_name: "demo/cache", source_tags: [], pushed_at: "2026-05-18" };
  const profile = { profile_id: "test" };
  const trend = { trend_score: 20, source_tags: [] };
  const readme = "# demo/cache\n\nREADME with usage examples";
  const documentHash = stableHash(`${readme}\n`);
  const oldInputHash = stableHash(`${documentHash}:${JSON.stringify(profile)}:${JSON.stringify(trend)}:test-model`);
  let analyzeCalls = 0;

  store.upsertAnalysis({
    repo_id: repo.repo_id,
    full_name: repo.full_name,
    analysis_date: "2026-05-18",
    profile_id: profile.profile_id,
    provider: "heuristic",
    model: "heuristic",
    input_hash: oldInputHash,
    structured_json: { summary: "cached", learning_value: { score: 10 }, profile_fit: { score: 10 }, confidence: { score: 10 } },
    validation_status: "ok"
  });

  const result = await analyzePreselectedRepos({
    preselected: [repo],
    trends: new Map([["1", trend]]),
    client: {
      async getReadme() {
        return readme;
      },
      async getLatestRelease() {
        return null;
      }
    },
    store,
    logger: { warn() {} },
    profile,
    runtimeConfig: { openaiModel: "test-model" },
    date: "2026-05-18",
    concurrency: 1,
    analyzeRepoFn: async () => {
      analyzeCalls += 1;
      return {
        provider: "heuristic",
        analysis: { summary: "fresh", learning_value: { score: 70 }, profile_fit: { score: 70 }, confidence: { score: 80 } }
      };
    }
  });

  const stored = store.getAnalysis(1, "2026-05-18", "test");
  assert.equal(analyzeCalls, 1);
  assert.equal(result.analyses.get("1").summary, "fresh");
  assert.notEqual(stored.input_hash, oldInputHash);
  assert.equal(stored.analysis_cache_version, "ai-debug-recovery-v1");
});

class MemoryStore {
  constructor() {
    this.documents = new Map();
    this.analyses = new Map();
  }

  getDocument(repoId) {
    return this.documents.get(String(repoId)) || null;
  }

  upsertDocument(document) {
    const stored = {
      ...document,
      document_hash: document.document_hash || stableHash(`${document.readme_text}\n${document.latest_release_notes}`)
    };
    this.documents.set(String(document.repo_id), stored);
    return stored;
  }

  getAnalysis(repoId, date, profileId) {
    return this.analyses.get(`${repoId}:${date}:${profileId}`) || null;
  }

  upsertAnalysis(analysis) {
    this.analyses.set(`${analysis.repo_id}:${analysis.analysis_date}:${analysis.profile_id}`, analysis);
    return analysis;
  }
}
