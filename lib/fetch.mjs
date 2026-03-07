const DEFAULTS = {
  retries: 2,
  retryDelayMs: 1000,
  timeoutMs: 30_000,
};

export async function fetchWithRetry(url, init = {}, options = {}) {
  const { retries, retryDelayMs, timeoutMs } = { ...DEFAULTS, ...options };

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const body = await response.text().catch(() => "(unreadable body)");
        throw new FetchError(
          `HTTP ${response.status} ${response.statusText}`,
          response.status,
          body,
        );
      }

      return response;
    } catch (error) {
      lastError = error;

      const isRetryable =
        error.name === "AbortError" ||
        (error instanceof FetchError && error.status >= 500);

      if (!isRetryable || attempt === retries) break;

      console.warn(
        `Attempt ${attempt + 1} failed, retrying in ${retryDelayMs}ms...`,
      );
      await sleep(retryDelayMs);
    }
  }

  throw lastError;
}

export async function postJson(url, data, options = {}) {
  return fetchWithRetry(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
    options,
  );
}

class FetchError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "FetchError";
    this.status = status;
    this.body = body;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
