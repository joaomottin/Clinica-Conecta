type FetchReadRetryOptions = {
  retries?: number;
  retryDelayMs?: number;
};

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

function shouldRetryStatus(status: number) {
  return status === 408 || status >= 500;
}

export async function fetchReadWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: FetchReadRetryOptions = {},
) {
  const method = requestMethod(input, init);
  if (method !== "GET" && method !== "HEAD") {
    throw new TypeError("fetchReadWithRetry aceita apenas requisições GET ou HEAD.");
  }

  const retries = Math.max(0, options.retries ?? 1);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 350);
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (!shouldRetryStatus(response.status) || attempt === retries) return response;
      await response.body?.cancel().catch(() => undefined);
    } catch (error) {
      lastError = error;
      if (attempt === retries) throw error;
    }

    const delay = retryDelayMs * 2 ** attempt;
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw lastError instanceof Error ? lastError : new Error("A requisição de leitura falhou.");
}
