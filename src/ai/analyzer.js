import { analyzeRepoHeuristically } from "./heuristicAnalyzer.js";
import { analyzeRepoWithOpenAI } from "./openaiAnalyzer.js";
import { coerceAnalysis, validateAnalysis } from "./schema.js";

export async function analyzeRepo({ repo, trend, documents, profile, runtimeConfig, noAi = false, referenceDate, logger = console }) {
  const input = {
    repo,
    trend,
    documents: {
      readme_excerpt: (documents?.readme_text || "").slice(0, 12_000),
      release_excerpt: (documents?.latest_release_notes || "").slice(0, 4000)
    },
    user_profile: profile
  };

  if (!noAi && runtimeConfig.openaiApiKey && runtimeConfig.openaiModel) {
    try {
      return {
        provider: "openai",
        analysis: await analyzeRepoWithOpenAI({
          input,
          apiKey: runtimeConfig.openaiApiKey,
          model: runtimeConfig.openaiModel,
          baseUrl: runtimeConfig.openaiBaseUrl,
          timeoutMs: runtimeConfig.openaiTimeoutMs
        })
      };
    } catch (error) {
      logger.warn?.(`AI 分析失败，降级为本地规则：${repo.full_name} - ${error.message}`);
    }
  }

  const heuristic = coerceAnalysis(analyzeRepoHeuristically({ repo, trend, documents, profile, referenceDate }));
  const validation = validateAnalysis(heuristic);
  if (!validation.ok) {
    throw new Error(`本地分析输出不符合 schema: ${validation.errors.join("; ")}`);
  }
  return {
    provider: "heuristic",
    analysis: heuristic
  };
}
