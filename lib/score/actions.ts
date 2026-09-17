import { linkRels, scriptSrcs } from "./html";
import { isHttpOk } from "./types";

type Doc = {
  status: number;
  body: string;
  contentType: string;
};

export function looksLikeJsonObject(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function assessMcp(
  docs: Record<string, Doc | undefined>,
  html: string,
): { level: "none" | "hint" | "present"; evidence: string } {
  const candidates = [
    docs["/.well-known/mcp.json"],
    docs["/.well-known/mcp"],
    docs["/mcp.json"],
  ];
  for (const doc of candidates) {
    if (!doc || !isHttpOk(doc.status) || !doc.body.trim()) continue;
    if (looksLikeMcpManifest(doc.body)) {
      return { level: "present", evidence: "MCP manifest JSON found" };
    }
    if (looksLikeJsonObject(doc.body)) {
      return { level: "hint", evidence: "JSON found at an MCP path but it does not look like a manifest" };
    }
  }

  const mcpLink = linkRels(html).find((link) => /\bmcp\b/i.test(link.rel));
  if (mcpLink) {
    return { level: "hint", evidence: `HTML link rel="${mcpLink.rel}"` };
  }
  return { level: "none", evidence: "No MCP well-known manifest" };
}

export function assessOpenApi(
  docs: Record<string, Doc | undefined>,
  html: string,
): { level: "none" | "hint" | "present"; evidence: string } {
  const paths = [
    "/openapi.json",
    "/openapi.yaml",
    "/openapi.yml",
    "/swagger.json",
    "/swagger.yaml",
    "/api/openapi.json",
    "/api/swagger.json",
  ];
  for (const path of paths) {
    const doc = docs[path];
    if (!doc || !isHttpOk(doc.status) || !doc.body.trim()) continue;
    if (looksLikeOpenApi(doc.body)) {
      return { level: "present", evidence: `OpenAPI/Swagger spec at ${path}` };
    }
  }

  const specLink = linkRels(html).find((link) =>
    /service-doc|describedby|openapi|swagger/i.test(link.rel),
  );
  if (specLink) {
    return { level: "hint", evidence: `HTML link rel="${specLink.rel}"` };
  }
  if (/swagger-ui|redoc|openapi/i.test(html)) {
    return { level: "hint", evidence: "Page HTML mentions OpenAPI/Swagger UI" };
  }
  return { level: "none", evidence: "No OpenAPI/Swagger spec discovered" };
}

export function assessWebMcp(html: string): {
  level: "none" | "hint" | "present";
  evidence: string;
} {
  if (
    /navigator\.modelContext|modelContextProtocol|webmcp|registerTool\s*\(/i.test(
      html,
    )
  ) {
    return {
      level: "present",
      evidence: "Static WebMCP/tool-registration signals in HTML",
    };
  }
  const src = scriptSrcs(html).find((value) => /webmcp|\bmcp\b/i.test(value));
  if (src) {
    return { level: "hint", evidence: `Script src looks MCP-related: ${src}` };
  }
  return {
    level: "none",
    evidence: "No static WebMCP signals (runtime JS not executed)",
  };
}

export function assessA2a(
  docs: Record<string, Doc | undefined>,
): { level: "none" | "present"; evidence: string } {
  const candidates = [docs["/.well-known/agent.json"], docs["/.well-known/agent-card.json"]];
  for (const doc of candidates) {
    if (doc && isHttpOk(doc.status) && looksLikeJsonObject(doc.body)) {
      return { level: "present", evidence: "A2A agent card JSON found" };
    }
  }
  return { level: "none", evidence: "No /.well-known/agent.json card" };
}

function looksLikeMcpManifest(body: string): boolean {
  if (!looksLikeJsonObject(body)) return false;
  const parsed = JSON.parse(body) as Record<string, unknown>;
  const keys = Object.keys(parsed).map((key) => key.toLowerCase());
  return [
    "mcpversion",
    "transport",
    "endpoint",
    "tools",
    "servers",
    "mcpservers",
    "serverinfo",
    "mcp",
  ].some((key) => keys.includes(key));
}

function looksLikeOpenApi(body: string): boolean {
  const trimmed = body.trim();
  if (/^openapi\s*:/im.test(trimmed) || /^swagger\s*:/im.test(trimmed)) {
    return true;
  }
  if (!looksLikeJsonObject(trimmed)) return false;
  const parsed = JSON.parse(trimmed) as Record<string, unknown>;
  return typeof parsed.openapi === "string" || typeof parsed.swagger === "string";
}
