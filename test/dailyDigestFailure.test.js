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
