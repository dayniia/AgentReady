const DEFAULT_ORIGIN = "http://localhost:3000";

export function allowedOrigin(): string {
  return process.env.APP_ORIGIN ?? DEFAULT_ORIGIN;
}

export function corsHeaders(requestOrigin?: string | null): Headers {
  const allowed = allowedOrigin();
  const origin = requestOrigin === allowed ? requestOrigin : allowed;
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  });
}
