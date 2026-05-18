import { analyzeRepoHeuristically } from "./heuristicAnalyzer.js";
import { analyzeRepoWithOpenAI } from "./openaiAnalyzer.js";
import { coerceAnalysis, validateAnalysis } from "./schema.js";
import { writeAiDebugArtifact } from "./debugArtifacts.js";
import { classifyAIError } from "./errors.js";

export async function analyzeRepo({ repo, trend, documents, profile, runtimeConfig, noAi = false, referenceDate, logger = console }) {
  const input = buildAiInput({ repo, trend, documents, profile });

  if (!noAi && runtimeConfig.openaiApiKey && runtimeConfig.openaiModel) {
    const debugArtifacts = [];
    const firstAttempt = await tryOpenAIAnalysis({
      repo,
      input,
      profile,
      runtimeConfig,
      referenceDate,
      attempt: 1,
      retryMode: false,
      logger
    });

    if (firstAttempt.ok) {
      return {
        provider: "openai",
        analysis: firstAttempt.analysis,
        attempts: 1
      };
    }
    if (firstAttempt.debugArtifactPath) debugArtifacts.push(firstAttempt.debugArtifactPath);

    let finalError = firstAttempt.error;
    let attempts = 1;
    if (classifyAIError(firstAttempt.error) === "parse_error") {
      attempts = 2;
      logger.warn?.(`AI JSON 解析失败，使用短输入重试一次：${repo.full_name} - ${firstAttempt.error.message}`);
      const retryAttempt = await tryOpenAIAnalysis({
        repo,
        input: buildAiInput({ repo, trend, documents, profile, shortMode: true }),
        profile,
        runtimeConfig,
        referenceDate,
        attempt: 2,
        retryMode: true,
        logger
      });

      if (retryAttempt.ok) {
        return {
          provider: "openai",
          analysis: retryAttempt.analysis,
          attempts
        };
      }

      if (retryAttempt.debugArtifactPath) debugArtifacts.push(retryAttempt.debugArtifactPath);
      finalError = retryAttempt.error;
    }

    const failureType = classifyAIError(finalError);
    logger.warn?.(`AI 分析失败，降级为本地规则：${repo.full_name} - ${failureType} - ${finalError.message}`);
    return buildHeuristicResult({ repo, trend, documents, profile, referenceDate, aiFailure: {
      type: failureType,
      message: finalError.message,
      attempts,
      debug_artifacts: debugArtifacts
    } });
  }

  return buildHeuristicResult({ repo, trend, documents, profile, referenceDate });
}

function buildAiInput({ repo, trend, documents, profile, shortMode = false }) {
  return {
    repo,
    trend,
    documents: {
      readme_excerpt: (documents?.readme_text || "").slice(0, shortMode ? 4000 : 12_000),
      release_excerpt: (documents?.latest_release_notes || "").slice(0, shortMode ? 1200 : 4000)
    },
    user_profile: profile
  };
}

async function tryOpenAIAnalysis({ repo, input, profile, runtimeConfig, referenceDate, attempt, retryMode, logger }) {
  try {
    const analysis = await analyzeRepoWithOpenAI({
      input,
      apiKey: runtimeConfig.openaiApiKey,
      model: runtimeConfig.openaiModel,
      baseUrl: runtimeConfig.openaiBaseUrl,
      timeoutMs: runtimeConfig.openaiTimeoutMs,
      retryMode
    });
    return { ok: true, analysis };
  } catch (error) {
    let debugArtifactPath = null;
    try {
      debugArtifactPath = await writeAiDebugArtifact({
        enabled: runtimeConfig.debugAi,
        debugDir: runtimeConfig.debugAiDir,
        repo,
        date: referenceDate,
        profileId: profile?.profile_id,
        attempt,
        retryMode,
        input,
        model: runtimeConfig.openaiModel,
        baseUrl: runtimeConfig.openaiBaseUrl,
        error
      });
    } catch (debugError) {
      logger.warn?.(`AI debug artifact 写入失败：${repo.full_name} - ${debugError.message}`);
    }
    return { ok: false, error, debugArtifactPath };
  }
}

function buildHeuristicResult({ repo, trend, documents, profile, referenceDate, aiFailure = null }) {
  const heuristic = coerceAnalysis(analyzeRepoHeuristically({ repo, trend, documents, profile, referenceDate }));
  const validation = validateAnalysis(heuristic);
  if (!validation.ok) {
    throw new Error(`本地分析输出不符合 schema: ${validation.errors.join("; ")}`);
  }
  return {
    provider: "heuristic",
    analysis: heuristic,
    aiFailure
  };
}
