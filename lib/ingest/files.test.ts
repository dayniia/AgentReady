import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readRouteFilesFromDirectory } from "./files";

const fixturesRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/nextjs-mini-api",
);

describe("readRouteFilesFromDirectory", () => {
  it("collects Next.js API routes and skips non-route files", () => {
    const files = readRouteFilesFromDirectory(fixturesRoot);
    const paths = files.map((file) => file.filePath).sort();
    expect(paths).toContain("app/api/bookings/route.ts");
    expect(paths).toContain("pages/api/hello.ts");
    expect(paths.some((filePath) => filePath.includes("lib/utils"))).toBe(false);
  });
});
