import {
  ClassificationCache,
  classificationCacheKey,
} from "./cache";
import {
  buildBatchPrompt,
  classifiedFrom,
  classifyRoute,
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

  if (pending.length === 1) {
    await classifyOne(pending[0], sourceByPath, options.generateJson, cache, results);
  } else if (pending.length > 1) {
    await classifyBatch(pending, sourceByPath, options.generateJson, cache, results);
    const missing = pending.filter((route) => {
      const current = results.get(cacheKey(route));
      return !current || current.classification_status !== "ok";
    });
    for (const route of missing) {
      await classifyOne(route, sourceByPath, options.generateJson, cache, results);
    }
  }

  return routes.map((route) => results.get(cacheKey(route)) ?? unclassifiedMissing(route));
}

async function classifyBatch(
  routes: Route[],
  sourceByPath: Map<string, string>,
  generateJson: JsonGenerator,
  cache: ClassificationCache,
  results: Map<string, ClassifiedRoute>,
) {
  try {
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
      parsed.map((item) => [`${item.method}:${item.path}`, item.fields]),
    );
    for (const route of routes) {
      const fields = byKey.get(`${route.method}:${route.path}`);
      if (!fields) {
        continue;
      }
      const classified = classifiedFrom(route, fields);
      cache.set(cacheKey(route), classified);
      results.set(cacheKey(route), classified);
    }
  } catch {
    // Per-route retry handles this.
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

function cacheKey(route: Route): string {
  return classificationCacheKey(route.sourceHash, route.method, route.path);
}

function unclassifiedMissing(route: Route): ClassifiedRoute {
  return {
    ...route,
    action_name: `${route.method.toLowerCase()}_unclassified`,
    description: "Needs review — missing classification.",
    action_type: "other",
    parameters: route.params,
    classification_status: "unclassified",
  };
}
