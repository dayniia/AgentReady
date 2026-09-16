import { describe, expect, it } from "vitest";
import { stripSecrets } from "./secrets";

describe("stripSecrets", () => {
  it("redacts common API key literals and leaves surrounding code", () => {
    const source = `
export async function GET() {
  const google = "AIzaSyAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const openai = "sk-abcdefghijklmnopqrstuvwxyz1234567890";
  return Response.json({ google, openai });
}
`;
    const stripped = stripSecrets(source);
    expect(stripped).not.toContain("AIza");
    expect(stripped).not.toContain("sk-abcdefghijklmnopqrstuvwxyz1234567890");
    expect(stripped).toContain("export async function GET()");
    expect(stripped).toContain('return Response.json({ google, openai })');
    expect(stripped).toContain("[REDACTED]");
  });

  it("redacts bearer tokens and PEM blocks", () => {
    const source = `
const headers = { Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aa" };
const pem = \`-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC
-----END PRIVATE KEY-----\`;
`;
    const stripped = stripSecrets(source);
    expect(stripped).toContain("Bearer [REDACTED]");
    expect(stripped).not.toContain("BEGIN PRIVATE KEY");
    expect(stripped).toContain("const headers");
    expect(stripped).toContain("const pem");
  });

  it("redacts .env-style assignments", () => {
    const source = `
GEMINI_API_KEY=real-secret-value
GITHUB_TOKEN="ghp_abcdefghijklmnopqrstuvwxyz1234567890"
PUBLIC_URL=https://example.com
`;
    const stripped = stripSecrets(source);
    expect(stripped).toContain("GEMINI_API_KEY=[REDACTED]");
    expect(stripped).toContain("GITHUB_TOKEN=[REDACTED]");
    expect(stripped).toContain("PUBLIC_URL=https://example.com");
  });

  it("redacts assigned secret identifiers", () => {
    const source = `const apiKey = "super-secret-value"; const name = "bookings";`;
    const stripped = stripSecrets(source);
    expect(stripped).toContain('apiKey = "[REDACTED]"');
    expect(stripped).toContain('const name = "bookings"');
  });

  it("leaves already-safe files unchanged", () => {
    const source = `
export async function POST(request: Request) {
  const { title } = await request.json();
  const url = process.env.API_URL;
  return Response.json({ title, url });
}
`;
    expect(stripSecrets(source)).toBe(source);
  });
});
