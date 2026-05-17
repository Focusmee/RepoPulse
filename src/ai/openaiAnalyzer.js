import { coerceAnalysis, validateAnalysis } from "./schema.js";
import { buildOpenAIMessages } from "./prompt.js";
import { fetchWithTimeout } from "../shared/http.js";

export async function analyzeRepoWithOpenAI({ input, apiKey, model, baseUrl = "https://api.openai.com/v1", timeoutMs = 30_000 }) {
  if (!apiKey || !model) {
    throw new Error("OPENAI_API_KEY 或 OPENAI_MODEL 未设置");
  }

  const response = await fetchWithTimeout(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: buildOpenAIMessages(input)
    })
  }, {
    timeoutMs,
    retries: 1,
    retryStatuses: [408, 409, 429, 500, 502, 503, 504]
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenAI 请求失败 ${response.status}: ${body.slice(0, 240)}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content || "";
  const parsed = JSON.parse(content);
  const coerced = coerceAnalysis(parsed);
  const validation = validateAnalysis(coerced);
  if (!validation.ok) {
    throw new Error(`OpenAI 输出不符合 schema: ${validation.errors.join("; ")}`);
  }
  return coerced;
}
