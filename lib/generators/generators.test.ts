import { describe, expect, it } from "vitest";
import type { ClassifiedRoute } from "@/lib/core";
import { generateLlmsTxt } from "./llms-txt";
import { generateMcpServer, generateMcpTools } from "./mcp";
import { generateOutputs } from "./index";

const sample: ClassifiedRoute[] = [
  {
    filePath: "app/api/bookings/route.ts",
    method: "GET",
    path: "/api/bookings",
    params: [],
    sourceHash: "a",
    action_name: "list_bookings",
    description: "Return every booking",
    action_type: "read",
    parameters: [],
    classification_status: "ok",
  },
  {
    filePath: "app/api/bookings/[id]/route.ts",
    method: "DELETE",
    path: "/api/bookings/[id]",
    params: [{ name: "id", in: "path", required: true }],
    sourceHash: "b",
    action_name: "delete_booking",
    description: "Remove a booking",
    action_type: "delete",
    parameters: [{ name: "id", in: "path", required: true }],
    classification_status: "ok",
  },
  {
    filePath: "app/api/scan/route.ts",
    method: "OPTIONS",
    path: "/api/scan",
    params: [],
    sourceHash: "c",
    action_name: "options_api_scan",
    description: "CORS preflight",
    action_type: "other",
    parameters: [],
    classification_status: "ok",
  },
];

describe("generateLlmsTxt", () => {
  it("lists callable actions and skips OPTIONS", () => {
    const text = generateLlmsTxt(sample, { title: "AgentReady" });
    expect(text).toContain("# AgentReady");
    expect(text).toContain("[list_bookings](/api/bookings): GET. Return every booking");
    expect(text).toContain("Params: id (path, required)");
    expect(text).not.toContain("OPTIONS");
  });
});

describe("generateMcpTools", () => {
  it("builds unique tools with JSON schema params", () => {
    const { tools } = generateMcpTools(sample);
    expect(tools.map((tool) => tool.name)).toEqual([
      "list_bookings",
      "delete_booking",
    ]);
    expect(tools[1]?.inputSchema.required).toEqual(["id"]);
    expect(tools[1]?.metadata).toEqual({
      method: "DELETE",
      path: "/api/bookings/[id]",
    });
  });
});

describe("generateMcpServer", () => {
  it("embeds tools and a BASE_URL fetch helper", () => {
    const source = generateMcpServer(sample, { title: "AgentReady" });
    expect(source).toContain("list_bookings");
    expect(source).toContain("process.env.BASE_URL");
    expect(source).toContain("tools/list");
  });
});

describe("generateOutputs", () => {
  it("returns llms.txt, mcp-tools.json, and mcp-server.mjs", () => {
    const files = generateOutputs(sample, { title: "AgentReady" });
    expect(files.map((file) => file.filename)).toEqual([
      "llms.txt",
      "mcp-tools.json",
      "mcp-server.mjs",
    ]);
    expect(JSON.parse(files[1]?.content ?? "{}").tools).toHaveLength(2);
  });
});
