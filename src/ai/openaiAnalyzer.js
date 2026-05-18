import { coerceAnalysis, validateAnalysis } from "./schema.js";
import { buildOpenAIMessages } from "./prompt.js";
import { AIProviderError, classifyHttpStatus } from "./errors.js";
import { fetchWithTimeout } from "../shared/http.js";

export async function analyzeRepoWithOpenAI({
  input,
  apiKey,
  model,
  baseUrl = "https://api.openai.com/v1",
  timeoutMs = 30_000,
  retryMode = false
}) {
  if (!apiKey || !model) {
    throw new Error("OPENAI_API_KEY 或 OPENAI_MODEL 未设置");
  }

  let response;
  try {
    response = await fetchWithTimeout(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: buildOpenAIMessages(input, { retryMode })
      })
    }, {
      timeoutMs,
      retries: 1,
      retryStatuses: [408, 409, 429, 500, 502, 503, 504]
    });
  } catch (error) {
    throw new AIProviderError(`OpenAI 请求失败：${error.message}`, {
      failureType: error?.name === "TimeoutError" || error?.code === "ETIMEDOUT" ? "timeout" : "http_error",
      cause: error
    });
  }

  const rawResponse = await response.text().catch(() => "");
  if (!response.ok) {
    throw new AIProviderError(`OpenAI 请求失败 ${response.status}: ${rawResponse.slice(0, 240)}`, {
      failureType: classifyHttpStatus(response.status),
      context: {
        status: response.status,
        rawResponse
      }
    });
  }

  let payload;
  try {
    payload = JSON.parse(rawResponse);
  } catch (error) {
    throw new AIProviderError(`OpenAI 响应体不是合法 JSON: ${error.message}`, {
      failureType: "http_error",
      context: {
        status: response.status,
        rawResponse
      },
      cause: error
    });
  }

  const content = payload.choices?.[0]?.message?.content || "";
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new AIProviderError(`OpenAI 输出不是合法 JSON: ${error.message}`, {
      failureType: "parse_error",
      context: {
        status: response.status,
        rawResponse,
        content
      },
      cause: error
    });
  }

  const coerced = coerceAnalysis(parsed);
  const validation = validateAnalysis(coerced);
  if (!validation.ok) {
    throw new AIProviderError(`OpenAI 输出不符合 schema: ${validation.errors.join("; ")}`, {
      failureType: "schema_error",
      context: {
        status: response.status,
        rawResponse,
        content,
        validationErrors: validation.errors
      }
    });
  }
  return coerced;
}

export function buildChatCompletionsBody({ input, model, retryMode = false }) {
  return {
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: buildOpenAIMessages(input, { retryMode })
  };
}
