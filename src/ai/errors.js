export class AIProviderError extends Error {
  constructor(message, { failureType = "http_error", context = {}, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "AIProviderError";
    this.failureType = failureType;
    this.context = context;
  }
}

export function classifyHttpStatus(status) {
  if (Number(status) === 429) return "rate_limit";
  if ([408, 504].includes(Number(status))) return "timeout";
  return "http_error";
}

export function classifyAIError(error) {
  if (error?.failureType) return error.failureType;
  if (error?.name === "TimeoutError" || error?.code === "ETIMEDOUT") return "timeout";
  return "http_error";
}
