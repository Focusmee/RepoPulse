export class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = "TimeoutError";
    this.code = "ETIMEDOUT";
  }
}

export async function fetchWithTimeout(
  url,
  options = {},
  { timeoutMs = 30_000, retries = 0, retryDelayMs = 500, retryStatuses = [502, 503, 504] } = {}
) {
  let lastError = null;
  const effectiveTimeoutMs = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0 ? Number(timeoutMs) : 30_000;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), effectiveTimeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      if (attempt < retries && retryStatuses.includes(response.status)) {
        await delay(retryDelayMs * 2 ** attempt);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error.name === "AbortError" ? new TimeoutError(`Request timed out after ${effectiveTimeoutMs}ms`) : error;
      if (attempt >= retries || !isRetriableError(lastError)) throw lastError;
      await delay(retryDelayMs * 2 ** attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

function isRetriableError(error) {
  return error?.code === "ETIMEDOUT" || error?.name === "TimeoutError" || error?.name === "TypeError";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
