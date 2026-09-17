import { describe, expect, it } from "vitest";
import { createRateLimiter, RateLimitError } from "./rate-limit";
import { runScan } from "./scan";

describe("runScan", () => {
  it("returns classified routes from mocked ingest", async () => {
    const result = await runScan("https://github.com/dayniia/AgentReady", {
      ingest: async () => ({
        repo: { owner: "dayniia", repo: "AgentReady" },
        files: [
          {
            filePath: "app/api/bookings/route.ts",
            content: "export async function GET() { return Response.json([]); }",
          },
        ],
      }),
      generateJson: async () => ({
        action_name: "list_bookings",
        description: "List bookings",
        action_type: "read",
      }),
    });
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]?.classification_status).toBe("ok");
    expect(result.routes[0]?.action_name).toBe("list_bookings");
    expect(result.outputs.map((file) => file.filename)).toEqual([
      "llms.txt",
      "mcp-tools.json",
      "mcp-server.mjs",
    ]);
    expect(result.outputs[0]?.content).toContain("list_bookings");
  });

  it("rejects an unsafe URL before ingest", async () => {
    await expect(runScan("https://evil.com/repo")).rejects.toThrow(
      /github.com/,
    );
  });
});

describe("rate limiter", () => {
  it("allows up to max requests then throws", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    limiter.check("1.1.1.1");
    limiter.check("1.1.1.1");
    expect(() => limiter.check("1.1.1.1")).toThrow(RateLimitError);
  });
});
