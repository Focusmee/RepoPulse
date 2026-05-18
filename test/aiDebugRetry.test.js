import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { analyzeRepo } from "../src/ai/analyzer.js";
import { analyzeRepoWithOpenAI } from "../src/ai/openaiAnalyzer.js";
import { LEARNING_DIMENSIONS } from "../src/ai/prompt.js";

test("AI parse error writes debug artifact and retries with shorter input", async () => {
  const originalFetch = globalThis.fetch;
  const debugDir = await mkdtemp(join(process.cwd(), ".tmp-ai-debug-retry-"));
  const badContent = '{"summary":"bad json"';
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push(JSON.parse(options.body));
    if (requests.length === 1) return jsonResponse({ choices: [{ message: { content: badContent } }] });
    return jsonResponse({ choices: [{ message: { content: JSON.stringify(validAnalysis()) } }] });
  };

  try {
    const result = await analyzeRepo({
      repo: repoFixture(),
      trend: { trend_score: 40, source_tags: ["github_trending:daily"] },
      documents: {
        readme_text: "README ".repeat(3000),
        latest_release_notes: "release ".repeat(800)
      },
      profile: profileFixture(),
      runtimeConfig: runtimeConfig(debugDir),
      referenceDate: "2026-05-18",
      logger: silentLogger()
    });

    assert.equal(result.provider, "openai");
    assert.equal(result.attempts, 2);
    assert.equal(requests.length, 2);
    assert.ok(requests[0].messages.at(-1).content.length > requests[1].messages.at(-1).content.length);

    const files = await listJsonFiles(debugDir);
    assert.equal(files.length, 1);
    const artifact = JSON.parse(await readFile(files[0], "utf8"));
    assert.equal(artifact.failure_type, "parse_error");
    assert.equal(artifact.response.message_content, badContent);
    assert.ok(artifact.error.stack.includes("AIProviderError"));
    assert.equal(artifact.input_summary.repo.full_name, "demo/repo");
  } finally {
    globalThis.fetch = originalFetch;
    await rm(debugDir, { recursive: true, force: true });
  }
});

test("AI parse retry failure falls back to heuristic without throwing", async () => {
  const originalFetch = globalThis.fetch;
  const debugDir = await mkdtemp(join(process.cwd(), ".tmp-ai-debug-fallback-"));
  globalThis.fetch = async () => jsonResponse({ choices: [{ message: { content: '{"still":"bad"' } }] });

  try {
    const result = await analyzeRepo({
      repo: repoFixture(),
      trend: { trend_score: 40, source_tags: ["github_trending:daily"] },
      documents: {
        readme_text: "# Demo\n\nInstall and usage examples for an agent framework.",
        latest_release_notes: ""
      },
      profile: profileFixture(),
      runtimeConfig: runtimeConfig(debugDir),
      referenceDate: "2026-05-18",
      logger: silentLogger()
    });

    assert.equal(result.provider, "heuristic");
    assert.equal(result.aiFailure.type, "parse_error");
    assert.equal(result.aiFailure.attempts, 2);
    assert.equal(result.aiFailure.debug_artifacts.length, 2);
    assert.equal((await listJsonFiles(debugDir)).length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(debugDir, { recursive: true, force: true });
  }
});

test("OpenAI analyzer classifies schema, rate limit, http and timeout failures", async () => {
  const originalFetch = globalThis.fetch;
  const cases = [
    {
      name: "schema_error",
      fetch: async () => jsonResponse({ choices: [{ message: { content: JSON.stringify({ summary: "missing fields" }) } }] }),
      failureType: "schema_error"
    },
    {
      name: "rate_limit",
      fetch: async () => new Response("rate limited", { status: 429 }),
      failureType: "rate_limit"
    },
    {
      name: "http_error",
      fetch: async () => new Response("bad gateway", { status: 502 }),
      failureType: "http_error"
    },
    {
      name: "timeout",
      fetch: async () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      },
      failureType: "timeout"
    }
  ];

  try {
    for (const item of cases) {
      globalThis.fetch = item.fetch;
      const error = await captureError(() =>
        analyzeRepoWithOpenAI({
          input: {
            repo: repoFixture(),
            trend: { trend_score: 40 },
            documents: { readme_excerpt: "# Demo", release_excerpt: "" },
            user_profile: profileFixture()
          },
          apiKey: "test-key",
          model: "test-model",
          baseUrl: "https://api.example.test/v1",
          timeoutMs: 30_000
        })
      );
      assert.equal(error.failureType, item.failureType, item.name);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function validAnalysis() {
  return {
    schema_version: "1.1",
    summary: "用于测试的 AI 项目分析",
    problem_solved: "帮助测试结构化输出",
    why_it_matters_now: "验证 JSON 重试链路",
    learning_value: {
      score: 82,
      level: "high",
      breakdown: LEARNING_DIMENSIONS.map((dimension) => ({
        ...dimension,
        score: 80,
        reason: `${dimension.label} 清晰`,
        evidence: "README 提供安装、示例和使用说明"
      })),
      reasons: [
        { reason: "文档足够清晰", evidence: "README 包含 install 和 usage" },
        { reason: "适合当前画像", evidence: "topics 包含 agent 和 llm" }
      ]
    },
    trend_explanation: { score_hint: "中", signals: ["daily trending"] },
    audience: ["AI 应用开发者"],
    profile_fit: { score: 85, why_for_this_user: "匹配 agent 学习目标" },
    recommended_reading_path: [{ step: 1, action: "阅读 README", goal: "了解项目用途" }],
    project_idea: "做一个最小 agent demo",
    risks: [{ risk: "需要核对维护状态", severity: "medium" }],
    confidence: { score: 80, reason: "基于 README 和 metadata" }
  };
}

function repoFixture() {
  return {
    repo_id: 1,
    full_name: "demo/repo",
    description: "agent framework",
    language: "TypeScript",
    topics: ["agent", "llm"],
    stars: 1000,
    forks: 100,
    open_issues: 3,
    pushed_at: "2026-05-18T00:00:00Z",
    license: "MIT"
  };
}

function runtimeConfig(debugDir) {
  return {
    openaiApiKey: "test-key",
    openaiModel: "test-model",
    openaiBaseUrl: "https://api.example.test/v1",
    openaiTimeoutMs: 30_000,
    debugAi: true,
    debugAiDir: debugDir
  };
}

function profileFixture() {
  return {
    profile_id: "ai-builder",
    role: "AI 应用开发者",
    preferred_languages: ["TypeScript", "Python"],
    interested_topics: ["agent", "llm"],
    excluded_topics: [],
    learning_goals: ["做应用", "跟趋势"]
  };
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}

async function listJsonFiles(dir) {
  const { readdir } = await import("node:fs/promises");
  return (await readdir(dir)).filter((file) => file.endsWith(".json")).map((file) => join(dir, file));
}

async function captureError(fn) {
  try {
    await fn();
  } catch (error) {
    return error;
  }
  throw new Error("Expected function to throw");
}

function silentLogger() {
  return { warn() {}, info() {} };
}
