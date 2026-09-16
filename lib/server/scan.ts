import {
  ClassificationCache,
  classifySourceFiles,
  createGeminiJsonGenerator,
  unclassified,
} from "@/lib/core";
import { extractNextJsRoutes } from "@/lib/core/extractors/nextjs";
import type { ClassifiedRoute, JsonGenerator, SourceFile } from "@/lib/core";
import { ingestGitHubRepo, ingestWorkspace, UnsafeUrlError } from "@/lib/ingest";
import type { GitHubRepoRef } from "@/lib/ingest";

export { UnsafeUrlError };

export type ScanResult = {
  repo: GitHubRepoRef;
  routes: ClassifiedRoute[];
  warnings: string[];
};

export type ScanDeps = {
  ingest?: typeof ingestGitHubRepo;
  classify?: (
    files: SourceFile[],
    generateJson: JsonGenerator,
  ) => Promise<ClassifiedRoute[]>;
  generateJson?: JsonGenerator | null;
  cache?: ClassificationCache;
};

const cache = new ClassificationCache();

export async function runScan(
  githubUrl: string,
  deps: ScanDeps = {},
): Promise<ScanResult> {
  const ingest = deps.ingest ?? ingestGitHubRepo;
  const { repo, files } = await ingest(githubUrl, {
    token: process.env.GITHUB_TOKEN,
  });
  return classifyIngested({ repo, files }, deps);
}

export async function runWorkspaceScan(
  deps: ScanDeps = {},
): Promise<ScanResult> {
  const { repo, files } = await ingestWorkspace();
  return classifyIngested({ repo, files }, deps);
}

async function classifyIngested(
  ingested: { repo: GitHubRepoRef; files: SourceFile[] },
  deps: ScanDeps,
): Promise<ScanResult> {
  const { repo, files } = ingested;
  const warnings: string[] = [];

  if (files.length === 0) {
    warnings.push("No Next.js API route files were found in this repository.");
    return { repo, routes: [], warnings };
  }

  const generateJson =
    deps.generateJson === undefined
      ? defaultGenerator(warnings)
      : deps.generateJson;

  if (!generateJson) {
    const routes = extractNextJsRoutes(files).map(unclassified);
    return { repo, routes, warnings };
  }

  const classify =
    deps.classify ??
    ((sourceFiles, json) =>
      classifySourceFiles(sourceFiles, {
        generateJson: json,
        cache: deps.cache ?? cache,
      }));

  const routes = await classify(files, generateJson);
  return { repo, routes, warnings };
}

function defaultGenerator(warnings: string[]): JsonGenerator | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    warnings.push(
      "GEMINI_API_KEY is not set; routes were extracted but not classified.",
    );
    return null;
  }
  return createGeminiJsonGenerator({
    apiKey,
    model: process.env.GEMINI_MODEL,
  });
}
