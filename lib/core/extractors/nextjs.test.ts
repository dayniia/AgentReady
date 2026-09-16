import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractNextJsRoutes } from "./nextjs";
import type { SourceFile } from "../types";

const fixturesRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/nextjs-mini-api",
);

function loadFixtureTree(root = fixturesRoot): SourceFile[] {
  const files: SourceFile[] = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      files.push({
        filePath: path.relative(root, full).replaceAll("\\", "/"),
        content: readFileSync(full, "utf8"),
      });
    }
  }

  walk(root);
  return files;
}

describe("extractNextJsRoutes", () => {
  const routes = extractNextJsRoutes(loadFixtureTree());

  it("extracts GET and POST from a single App Router route.ts", () => {
    const bookings = routes.filter((route) => route.path === "/api/bookings");
    expect(bookings.map((route) => route.method)).toEqual(["GET", "POST"]);
    const post = bookings.find((route) => route.method === "POST");
    expect(post?.params).toEqual(
      expect.arrayContaining([
        { name: "title", in: "body", required: false },
        { name: "date", in: "body", required: false },
      ]),
    );
  });

  it("extracts dynamic [id] path params", () => {
    const byId = routes.filter((route) => route.path === "/api/bookings/[id]");
    expect(byId.map((route) => route.method)).toEqual(["DELETE", "GET", "PATCH"]);
    expect(byId[0]?.params).toEqual(
      expect.arrayContaining([{ name: "id", in: "path", required: true }]),
    );
  });

  it("extracts catch-all [...slug] segments", () => {
    const docs = routes.find((route) => route.path === "/api/docs/[...slug]");
    expect(docs).toMatchObject({
      method: "GET",
      params: [{ name: "slug", in: "path", required: true }],
    });
  });

  it("extracts Pages Router handlers and req.method checks", () => {
    const hello = routes.filter((route) => route.path === "/api/hello");
    expect(hello.map((route) => route.method)).toEqual(["GET", "POST"]);
    expect(hello[0]?.filePath).toBe("pages/api/hello.ts");
  });

  it("reads query param names from searchParams.get", () => {
    const search = routes.find((route) => route.path === "/api/search");
    expect(search?.params).toEqual(
      expect.arrayContaining([
        { name: "q", in: "query", required: false },
        { name: "limit", in: "query", required: false },
      ]),
    );
  });

  it("reads export { GET, POST } lists", () => {
    const health = routes.filter((route) => route.path === "/api/health");
    expect(health.map((route) => route.method)).toEqual(["GET", "POST"]);
  });

  it("returns no routes for files with no HTTP exports", () => {
    expect(routes.some((route) => route.path === "/api/empty")).toBe(false);
  });

  it("ignores non-route files", () => {
    expect(routes.every((route) => !route.filePath.includes("lib/utils"))).toBe(
      true,
    );
  });

  it("does not invent params that are not in the source", () => {
    const getBookings = routes.find(
      (route) => route.path === "/api/bookings" && route.method === "GET",
    );
    expect(getBookings?.params).toEqual([]);
  });

  it("strips GET body params that only exist on sibling methods", () => {
    const getById = routes.find(
      (route) => route.path === "/api/bookings/[id]" && route.method === "GET",
    );
    expect(getById?.params.some((param) => param.in === "body")).toBe(false);
  });
});
