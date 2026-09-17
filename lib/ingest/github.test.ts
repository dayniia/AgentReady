import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { ingestGitHubRepo, routeFilesFromZip } from "./github";
import { UnsafeUrlError } from "./ssrf";

function mockResponse(
  body: ArrayBuffer | null,
  url: string,
  status = 200,
): Response {
  const response = new Response(body, { status });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/nextjs-mini-api",
);

async function fixtureZip(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const prefix = "owner-repo-sha";
  zip.file(
    `${prefix}/app/api/bookings/route.ts`,
    readFileSync(path.join(fixtureRoot, "app/api/bookings/route.ts"), "utf8"),
  );
  zip.file(`${prefix}/lib/utils.ts`, "export const skip = true;");
  zip.file(`${prefix}/README.md`, "# not a route");
  zip.file(`${prefix}/.env`, "SECRET=nope");
  zip.file(
    `${prefix}/fixtures/nextjs-mini-api/app/api/bookings/route.ts`,
    "export async function GET() { return Response.json([]); }",
  );
  return zip.generateAsync({ type: "arraybuffer" });
}

describe("routeFilesFromZip", () => {
  it("keeps only Next.js API route files", async () => {
    const files = await routeFilesFromZip(await fixtureZip());
    expect(files.map((file) => file.filePath)).toEqual([
      "app/api/bookings/route.ts",
    ]);
    expect(files[0]?.content).toContain("export async function GET");
  });
});

describe("ingestGitHubRepo", () => {
  it("fetches a zipball from the constructed GitHub API URL", async () => {
    const zip = await fixtureZip();
    const files = await ingestGitHubRepo("https://github.com/dayniia/AgentReady", {
      fetch: async (url) => {
        expect(url).toBe(
          "https://api.github.com/repos/dayniia/AgentReady/zipball",
        );
        return mockResponse(
          zip,
          "https://codeload.github.com/dayniia/AgentReady/legacy.zip/refs/heads/main",
        );
      },
    });
    expect(files.repo).toEqual({
      owner: "dayniia",
      repo: "AgentReady",
      ref: undefined,
    });
    expect(files.files).toHaveLength(1);
  });

  it("rejects a zipball redirect off the allowlist", async () => {
    await expect(
      ingestGitHubRepo("https://github.com/dayniia/AgentReady", {
        fetch: async () => mockResponse(null, "https://evil.com/steal.zip"),
      }),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
  });
});
