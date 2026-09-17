import { UnsafeUrlError } from "./ssrf";

export const SCORE_FETCH_ATTEMPTS = 3;
export const SCORE_RETRY_BASE_MS = 400;

export function isRetryableFetchError(error: unknown): boolean {
  if (error instanceof UnsafeUrlError) return false;
  const text = error instanceof Error ? error.message : String(error);
  return /timeout|timed out|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|hang up|network|fetch failed|Could not resolve|Could not fetch|socket/i.test(
    text,
  );
}

export async function withFetchRetries<T>(
  run: () => Promise<T>,
  attempts = SCORE_FETCH_ATTEMPTS,
): Promise<T> {
  let lastError: unknown;
  for (let index = 0; index < attempts; index++) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isRetryableFetchError(error) || index === attempts - 1) {
        throw error;
      }
      await sleep(SCORE_RETRY_BASE_MS * 2 ** index);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Fetch failed");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
