import { corsHeaders } from "@/lib/server/cors";
import { createRateLimiter, RateLimitError } from "@/lib/server/rate-limit";
import { runScan, UnsafeUrlError } from "@/lib/server/scan";

const limiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10 });

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

export async function POST(request: Request) {
  const headers = corsHeaders(request.headers.get("origin"));
  headers.set("Content-Type", "application/json");

  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    limiter.check(ip);

    const body = (await request.json()) as { githubUrl?: unknown };
    if (typeof body.githubUrl !== "string" || body.githubUrl.trim() === "") {
      return Response.json(
        { error: "githubUrl is required" },
        { status: 400, headers },
      );
    }

    const result = await runScan(body.githubUrl);
    return Response.json(result, { status: 200, headers });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json({ error: error.message }, { status: 429, headers });
    }
    if (error instanceof UnsafeUrlError) {
      return Response.json({ error: error.message }, { status: 400, headers });
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid JSON body" }, { status: 400, headers });
    }
    const message = error instanceof Error ? error.message : "Scan failed";
    return Response.json({ error: message }, { status: 502, headers });
  }
}
