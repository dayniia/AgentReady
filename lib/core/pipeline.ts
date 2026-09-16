import {
  ClassificationCache,
  classificationCacheKey,
} from "./cache";
import { classifyRoute } from "./classify";
import { extractNextJsRoutes } from "./extractors/nextjs";
import type { JsonGenerator } from "./classify";
import type { ClassifiedRoute, SourceFile } from "./types";

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
  const classified: ClassifiedRoute[] = [];

  for (const route of routes) {
    const key = classificationCacheKey(
      route.sourceHash,
      route.method,
      route.path,
    );
    const cached = cache.get(key);
    if (cached) {
      classified.push(cached);
      continue;
    }
    const source = sourceByPath.get(route.filePath) ?? "";
    const result = await classifyRoute(route, source, options.generateJson);
    cache.set(key, result);
    classified.push(result);
  }

  return classified;
}
