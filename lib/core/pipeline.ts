import {
  ClassificationCache,
  classificationCacheKey,
} from "./cache";
import {
  buildBatchPrompt,
  classifiedFrom,
  classifyRoute,
  unclassified,
} from "./classify";
import { extractNextJsRoutes } from "./extractors/nextjs";
import type { JsonGenerator } from "./classify";
import { parseClassificationBatch } from "./schema";
import type { ClassifiedRoute, Route, SourceFile } from "./types";

export type PipelineOptions = {
  generateJson: JsonGenerator;
  cache?: ClassificationCache;
};

export async function classifySourceFiles(
  files: SourceFile[],
  options: PipelineOptions,
): Promise<ClassifiedRoute[]> {
  const cache = options.cache ?? new ClassificationCache();
  const routes = extractNextJsRoutes(files);
  const sourceByPath = new Map(
    files.map((file) => [file.filePath.replaceAll("\\", "/"), file.content]),
  );

  const results = new Map<string, ClassifiedRoute>();
  const pending: Route[] = [];

  for (const route of routes) {
    const key = cacheKey(route);
    const cached = cache.get(key);
    if (cached) {
      results.set(key, cached);
    } else {
      pending.push(route);
    }
  }

  try {
    if (pending.length === 1) {
      await classifyOne(pending[0], sourceByPath, options.generateJson, cache, results);
    } else if (pending.length > 1) {
      await tryBatch(pending, sourceByPath, options.generateJson, cache, results);
      const missing = pending.filter((route) => !isOk(results.get(cacheKey(route))));
      if (missing.length > 0) {
        await tryBatch(missing, sourceByPath, options.generateJson, cache, results);
      }
    }
  } catch (error) {
    stampQuotaFailures(pending, results, error);
  }

  return routes.map((route) => {
    const current = results.get(cacheKey(route));
    return current ?? unclassified(route);
  });
}

async function classifyBatch(
  routes: Route[],
  sourceByPath: Map<string, string>,
  generateJson: JsonGenerator,
  cache: ClassificationCache,
  results: Map<string, ClassifiedRoute>,
) {
  const raw = await generateJson(
    buildBatchPrompt(
      routes.map((route) => ({
        route,
        source: sourceByPath.get(route.filePath) ?? "",
      })),
    ),
  );
  const parsed = parseClassificationBatch(raw);
  const byKey = new Map(
    parsed.map((item) => [matchKey(item.method, item.path), item.fields]),
  );
  for (const route of routes) {
    const fields = byKey.get(matchKey(route.method, route.path));
    if (!fields) {
      continue;
    }
    const classified = classifiedFrom(route, fields);
    cache.set(cacheKey(route), classified);
    results.set(cacheKey(route), classified);
  }
}

async function tryBatch(
  routes: Route[],
  sourceByPath: Map<string, string>,
  generateJson: JsonGenerator,
  cache: ClassificationCache,
  results: Map<string, ClassifiedRoute>,
) {
  try {
    await classifyBatch(routes, sourceByPath, generateJson, cache, results);
  } catch (error) {
    if (isQuotaError(error)) {
      throw error;
    }
  }
}
async function classifyOne(
  route: Route,
  sourceByPath: Map<string, string>,
  generateJson: JsonGenerator,
  cache: ClassificationCache,
  results: Map<string, ClassifiedRoute>,
) {
  const result = await classifyRoute(
    route,
    sourceByPath.get(route.filePath) ?? "",
    generateJson,
  );
  if (result.classification_status === "ok") {
    cache.set(cacheKey(route), result);
  }
  results.set(cacheKey(route), result);
}

function stampQuotaFailures(
  pending: Route[],
  results: Map<string, ClassifiedRoute>,
  error: unknown,
) {
  if (!isQuotaError(error)) {
    throw error;
  }
  const message =
    error instanceof Error ? error.message : "Gemini quota exceeded";
  for (const route of pending) {
    if (isOk(results.get(cacheKey(route)))) {
      continue;
    }
    const result = unclassified(route);
    result.description = `Needs review — ${message}`;
    results.set(cacheKey(route), result);
  }
}

function isOk(route: ClassifiedRoute | undefined): boolean {
  return route?.classification_status === "ok";
}

function isQuotaError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return /429|RESOURCE_EXHAUSTED|quota/i.test(text);
}

function matchKey(method: string, path: string): string {
  const normalizedPath = path.replace(/\/+$/, "") || "/";
  return `${method.toUpperCase()}:${normalizedPath}`;
}

function cacheKey(route: Route): string {
  return classificationCacheKey(route.sourceHash, route.method, route.path);
}
