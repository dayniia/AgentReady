import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { isRouteFile, normalizePath } from "@/lib/core/extractors/nextjs";
import type { SourceFile } from "@/lib/core/types";
import { MAX_ROUTE_FILE_BYTES } from "./limits";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
]);

export function readRouteFilesFromDirectory(root: string): SourceFile[] {
  const files: SourceFile[] = [];

  function walk(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry)) {
        continue;
      }
      const full = path.join(dir, entry);
      let stats;
      try {
        stats = statSync(full);
      } catch {
        continue;
      }
      if (stats.isDirectory()) {
        walk(full);
        continue;
      }
      const filePath = normalizePath(path.relative(root, full));
      if (!isRouteFile(filePath) || stats.size > MAX_ROUTE_FILE_BYTES) {
        continue;
      }
      files.push({
        filePath,
        content: readFileSync(full, "utf8"),
      });
    }
  }

  walk(root);
  return files;
}
