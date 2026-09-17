import { fetchSafeHttps, type FetchedDoc, type LiveFetchOptions } from "@/lib/ingest/live";
import { withFetchRetries } from "@/lib/ingest/retry";
import { assertSafeLiveUrl, UnsafeUrlError } from "@/lib/ingest/ssrf";
import { scoreDocuments, type ScoreResult } from "@/lib/score";
import { isHttpOk } from "@/lib/score/types";

export { UnsafeUrlError };

export const PROBE_PATHS = [
  "/llms.txt",
  "/.well-known/llms.txt",
  "/llms-full.txt",
  "/robots.txt",
  "/sitemap.xml",
  "/sitemap_index.xml",
  "/.well-known/mcp.json",
  "/.well-known/mcp",
  "/mcp.json",
  "/openapi.json",
  "/openapi.yaml",
  "/openapi.yml",
  "/swagger.json",
  "/swagger.yaml",
  "/api/openapi.json",
  "/api/swagger.json",
  "/.well-known/agent.json",
  "/.well-known/agent-card.json",
] as const;

const PROBE_TIMEOUT_MS = 8_000;

export type ScoreDeps = {
  fetchDocument?: (
    url: string,
    options?: LiveFetchOptions,
  ) => Promise<FetchedDoc>;
  fetchOptions?: LiveFetchOptions;
};

export async function runScore(
  url: string,
  deps: ScoreDeps = {},
): Promise<ScoreResult> {
  assertSafeLiveUrl(url);
  const fetchDocument = deps.fetchDocument ?? fetchSafeHttps;
  const homepage = await withFetchRetries(() =>
    fetchDocument(url, deps.fetchOptions),
  );
  if (!isHttpOk(homepage.status)) {
    throw new Error(
      `Could not fetch URL (${homepage.status}). Unreachable pages are a scan error, not a score of 0.`,
    );
  }

  const origin = new URL(homepage.finalUrl).origin;
  const byPath: Record<string, FetchedDoc | undefined> = {};
  const warnings: string[] = [];
  if (homepage.truncated) {
    warnings.push(
      "Homepage HTML was truncated to the size cap; scoring used the first chunk.",
    );
  }

  const probeOptions: LiveFetchOptions = {
    ...deps.fetchOptions,
    timeoutMs: deps.fetchOptions?.timeoutMs ?? PROBE_TIMEOUT_MS,
  };

  await Promise.all(
    PROBE_PATHS.map(async (path) => {
      const requested = `${origin}${path}`;
      try {
        byPath[path] = await withFetchRetries(() =>
          fetchDocument(requested, probeOptions),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "request failed";
        byPath[path] = {
          requestedUrl: requested,
          finalUrl: requested,
          status: 0,
          contentType: "",
          body: "",
          fetchError: message,
        };
        warnings.push(`Could not verify ${path}: ${message}`);
      }
    }),
  );

  const result = scoreDocuments({
    targetUrl: url,
    homepage,
    byPath,
  });
  return { ...result, warnings: [...warnings, ...result.warnings] };
}
