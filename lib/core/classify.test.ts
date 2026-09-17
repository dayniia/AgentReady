import { describe, expect, it, vi } from "vitest";
import { ClassificationCache } from "./cache";
import { classifyRoute } from "./classify";
import { classifySourceFiles } from "./pipeline";
import type { Route } from "./types";

const route: Route = {
  filePath: "app/api/bookings/route.ts",
  method: "GET",
  path: "/api/bookings",
  params: [],
  sourceHash: "abc123",
};

describe("classifyRoute", () => {
  it("maps valid model JSON onto the extracted route", async () => {
    const result = await classifyRoute(route, "export async function GET() {}", async () => ({
      action_name: "list_bookings",
      description: "Return every booking",
      action_type: "read",
      parameters: [],
    }));
    expect(result.classification_status).toBe("ok");
    expect(result.action_name).toBe("list_bookings");
    expect(result.method).toBe("GET");
  });

  it("falls back to unclassified on malformed output", async () => {
    const result = await classifyRoute(route, "export async function GET() {}", async () => ({
      nope: true,
    }));
    expect(result.classification_status).toBe("unclassified");
    expect(result.action_type).toBe("other");
  });

  it("keeps the Gemini error in the unclassified description", async () => {
    const result = await classifyRoute(route, "export async function GET() {}", async () => {
      throw new Error("Gemini request failed (404 gemini-2.0-flash)");
    });
    expect(result.classification_status).toBe("unclassified");
    expect(result.description).toContain("404 gemini-2.0-flash");
  });

  it("does not let the model invent parameters", async () => {
    const withParam: Route = {
      ...route,
      params: [{ name: "id", in: "path", required: true }],
      path: "/api/bookings/[id]",
    };
    const result = await classifyRoute(
      withParam,
      "export async function GET() {}",
      async () => ({
        action_name: "get_booking",
        description: "Get one booking",
        action_type: "read",
        parameters: [
          { name: "id", in: "path", required: true },
          { name: "admin_token", in: "query", required: true },
        ],
      }),
    );
    expect(result.parameters).toEqual([
      { name: "id", in: "path", required: true },
    ]);
  });
});

describe("classifySourceFiles cache", () => {
  it("skips a second Gemini call for the same hash/method/path", async () => {
    const generateJson = vi.fn(async () => ({
      action_name: "list_bookings",
      description: "Return every booking",
      action_type: "read",
    }));
    const files = [
      {
        filePath: "app/api/bookings/route.ts",
        content: "export async function GET() { return Response.json([]); }",
      },
    ];
    const cache = new ClassificationCache();
    await classifySourceFiles(files, { generateJson, cache });
    await classifySourceFiles(files, { generateJson, cache });
    expect(generateJson).toHaveBeenCalledTimes(1);
  });

  it("classifies multiple routes from one batch response", async () => {
    const generateJson = vi.fn(async () => ({
      classifications: [
        {
          method: "GET",
          path: "/api/bookings",
          action_name: "list_bookings",
          description: "List bookings",
          action_type: "read",
        },
        {
          method: "POST",
          path: "/api/bookings",
          action_name: "create_booking",
          description: "Create a booking",
          action_type: "create",
        },
      ],
    }));
    const files = [
      {
        filePath: "app/api/bookings/route.ts",
        content:
          "export async function GET() { return Response.json([]); }\nexport async function POST() { return Response.json({}); }",
      },
    ];
    const routes = await classifySourceFiles(files, { generateJson });
    expect(generateJson).toHaveBeenCalledTimes(1);
    expect(routes.map((route) => route.action_name)).toEqual([
      "list_bookings",
      "create_booking",
    ]);
  });
});
