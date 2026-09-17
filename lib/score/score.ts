import { assessA2a, assessMcp, assessOpenApi, assessWebMcp } from "./actions";
import { assessLandmarks, assessRawHtml } from "./content";
import { assessLlmsTxt } from "./llms";
import { assessRobotsTxt } from "./robots";
import { assessMeta, assessSchema } from "./structured";
import {
  bandFor,
  check,
  isHttpOk,
  rescale,
  type ProbeDoc,
  type ScoreAxis,
  type ScoreCategory,
  type ScoreCheck,
  type ScoreDocuments,
  type ScoreResult,
} from "./types";
import { WEIGHTS } from "./weights";

const CATEGORY_NAMES: Record<1 | 2 | 3 | 4, string> = {
  1: "Discovery & Manifests",
  2: "Structured Data",
  3: "Action Exposure",
  4: "Raw Content Accessibility",
};

const FRONTIER_NOTE =
  "Emerging standard, near-zero adoption industry-wide. A 0 here is an opportunity, not a failure.";

const LLMS_PATHS = ["/llms.txt", "/.well-known/llms.txt"];
const SITEMAP_PATHS = ["/sitemap.xml", "/sitemap_index.xml"];
const MCP_PATHS = ["/.well-known/mcp.json", "/.well-known/mcp", "/mcp.json"];
const OPENAPI_PATHS = [
  "/openapi.json",
  "/openapi.yaml",
  "/openapi.yml",
  "/swagger.json",
  "/swagger.yaml",
  "/api/openapi.json",
  "/api/swagger.json",
];
const A2A_PATHS = ["/.well-known/agent.json", "/.well-known/agent-card.json"];

export function scoreDocuments(docs: ScoreDocuments): ScoreResult {
  const html = docs.homepage.body;
  const byPath = docs.byPath;
  const warnings: string[] = [];
  const checks: ScoreCheck[] = [];

  const llmsState = probeState(byPath, LLMS_PATHS);
  if (llmsState === "unverified") {
    checks.push(unverified("llms", 1, "llms.txt quality", WEIGHTS.llms, byPath, LLMS_PATHS));
  } else {
    const llmsDoc = firstOk(byPath, LLMS_PATHS);
    const llmsQuality = assessLlmsTxt(
      llmsDoc && isHttpOk(llmsDoc.status) ? llmsDoc.body : undefined,
    );
    checks.push(
      check({
        id: "llms",
        category: 1,
        label: "llms.txt quality",
        max: WEIGHTS.llms,
        score:
          llmsQuality === "populated"
            ? WEIGHTS.llms
            : llmsQuality === "stub"
              ? 5
              : 0,
        evidence:
          llmsQuality === "populated"
            ? "Title, description, and linked resources present"
            : llmsQuality === "stub"
              ? "llms.txt exists but is empty or too thin"
              : "No llms.txt at /llms.txt or /.well-known/llms.txt",
      }),
    );
  }

  const sitemapState = probeState(byPath, SITEMAP_PATHS);
  if (sitemapState === "unverified") {
    checks.push(
      unverified("sitemap", 1, "sitemap.xml present", WEIGHTS.sitemap, byPath, SITEMAP_PATHS),
    );
  } else {
    const sitemapDoc = firstOk(byPath, SITEMAP_PATHS);
    const sitemapOk = Boolean(
      sitemapDoc &&
        /<(?:urlset|sitemapindex)\b/i.test(sitemapDoc.body) &&
        /<loc\b/i.test(sitemapDoc.body),
    );
    checks.push(
      check({
        id: "sitemap",
        category: 1,
        label: "sitemap.xml present",
        max: WEIGHTS.sitemap,
        score: sitemapOk ? WEIGHTS.sitemap : 0,
        evidence: sitemapOk
          ? "Sitemap XML with at least one loc"
          : "No usable sitemap.xml",
      }),
    );
  }

  const robotsProbe = byPath["/robots.txt"];
  if (robotsProbe?.fetchError) {
    checks.push(
      unverified("robots", 1, "robots.txt allows AI crawlers", WEIGHTS.robots, byPath, [
        "/robots.txt",
      ]),
    );
  } else {
    const robots = assessRobotsTxt(
      robotsProbe && isHttpOk(robotsProbe.status) ? robotsProbe.body : undefined,
    );
    checks.push(
      check({
        id: "robots",
        category: 1,
        label: "robots.txt allows AI crawlers",
        max: WEIGHTS.robots,
        score:
          robots.level === "allow"
            ? WEIGHTS.robots
            : robots.level === "mixed"
              ? 3
              : 0,
        evidence: robots.reasons.join("; "),
      }),
    );
  }

  const schema = assessSchema(html);
  checks.push(
    check({
      id: "schema",
      category: 2,
      label: "Schema.org structured data",
      max: WEIGHTS.schema,
      score:
        schema.quality === "rich"
          ? WEIGHTS.schema
          : schema.quality === "some"
            ? 6
            : 0,
      evidence:
        schema.types.length > 0
          ? `Types: ${schema.types.slice(0, 8).join(", ")}`
          : "No JSON-LD or schema.org microdata",
    }),
  );

  const meta = assessMeta(html);
  const metaScore =
    meta.hasTitle && meta.hasDescription
      ? WEIGHTS.meta
      : meta.hasTitle || meta.hasDescription
        ? 4
        : 0;
  checks.push(
    check({
      id: "meta",
      category: 2,
      label: "Open Graph / meta tags",
      max: WEIGHTS.meta,
      score: metaScore,
      evidence:
        meta.hasTitle && meta.hasDescription
          ? `Title and description present`
          : meta.hasTitle
            ? "Title found, description missing"
            : meta.hasDescription
              ? "Description found, title missing"
              : "No title or description meta",
    }),
  );

  const mcp = assessMcp(byPath, html);
  const mcpState = probeState(byPath, MCP_PATHS);
  if (mcp.level === "none" && mcpState === "unverified") {
    checks.push(
      unverified("mcp", 3, "MCP server discoverable", WEIGHTS.mcp, byPath, MCP_PATHS),
    );
  } else {
    checks.push(
      check({
        id: "mcp",
        category: 3,
        label: "MCP server discoverable",
        max: WEIGHTS.mcp,
        score: mcp.level === "present" ? WEIGHTS.mcp : mcp.level === "hint" ? 7 : 0,
        evidence: mcp.evidence,
      }),
    );
  }

  const openapi = assessOpenApi(byPath, html);
  const openapiState = probeState(byPath, OPENAPI_PATHS);
  if (openapi.level === "none" && openapiState === "unverified") {
    checks.push(
      unverified(
        "openapi",
        3,
        "OpenAPI/Swagger spec discoverable",
        WEIGHTS.openapi,
        byPath,
        OPENAPI_PATHS,
      ),
    );
  } else {
    checks.push(
      check({
        id: "openapi",
        category: 3,
        label: "OpenAPI/Swagger spec discoverable",
        max: WEIGHTS.openapi,
        score:
          openapi.level === "present"
            ? WEIGHTS.openapi
            : openapi.level === "hint"
              ? 5
              : 0,
        evidence: openapi.evidence,
      }),
    );
  }

  const webmcp = assessWebMcp(html);
  checks.push(
    check({
      id: "webmcp",
      category: 3,
      label: "WebMCP tool declarations (static)",
      max: WEIGHTS.webmcp,
      score:
        webmcp.level === "present" ? WEIGHTS.webmcp : webmcp.level === "hint" ? 4 : 0,
      evidence: webmcp.evidence,
    }),
  );

  const a2a = assessA2a(byPath);
  const a2aState = probeState(byPath, A2A_PATHS);
  if (a2a.level === "none" && a2aState === "unverified") {
    checks.push(unverified("a2a", 3, "A2A agent card", WEIGHTS.a2a, byPath, A2A_PATHS));
  } else {
    checks.push(
      check({
        id: "a2a",
        category: 3,
        label: "A2A agent card",
        max: WEIGHTS.a2a,
        score: a2a.level === "present" ? WEIGHTS.a2a : 0,
        evidence: a2a.evidence,
      }),
    );
  }

  const raw = assessRawHtml(html);
  checks.push(
    check({
      id: "rawHtml",
      category: 4,
      label: "Meaningful raw HTML text",
      max: WEIGHTS.rawHtml,
      score:
        raw.level === "meaningful"
          ? WEIGHTS.rawHtml
          : raw.level === "thin"
            ? 7
            : 0,
      evidence:
        raw.level === "empty" && raw.spaShell
          ? `SPA shell with ${raw.textLength} visible characters`
          : `${raw.textLength} visible characters in raw HTML`,
    }),
  );

  const landmarks = assessLandmarks(html);
  const landmarkScore = (landmarks.h1 ? 3 : 0) + (landmarks.main ? 3 : 0);
  checks.push(
    check({
      id: "landmarks",
      category: 4,
      label: "Semantic landmarks",
      max: WEIGHTS.landmarks,
      score: landmarkScore,
      evidence:
        landmarks.h1 && landmarks.main
          ? "h1 and main/article present"
          : landmarks.h1
            ? "h1 present, main/article missing"
            : landmarks.main
              ? "main/article present, h1 missing"
              : "No h1 or main landmark",
    }),
  );

  if (byPath["/llms-full.txt"] && isHttpOk(byPath["/llms-full.txt"].status)) {
    warnings.push("llms-full.txt is present (bonus signal, not extra points).");
  }

  const todayChecks = checks.filter((item) => item.category !== 3);
  const frontierChecks = checks.filter((item) => item.category === 3);
  const today = axisFromChecks("Today's Readiness", todayChecks);
  const frontier = axisFromChecks(
    "Frontier Score",
    frontierChecks,
    FRONTIER_NOTE,
  );

  const categories: ScoreCategory[] = ([1, 2, 3, 4] as const).map((id) => {
    const items = checks.filter((item) => item.category === id);
    const verified = items.filter((item) => item.status !== "unverified");
    return {
      id,
      name: CATEGORY_NAMES[id],
      score: verified.reduce((sum, item) => sum + item.score, 0),
      max: verified.reduce((sum, item) => sum + item.max, 0),
    };
  });

  return {
    url: docs.homepage.finalUrl || docs.targetUrl,
    origin: originOf(docs.homepage.finalUrl || docs.targetUrl),
    today,
    frontier,
    total: today.total ?? 0,
    max: 100,
    band: today.band ?? "invisible",
    categories,
    checks,
    warnings,
  };
}

function axisFromChecks(
  label: string,
  items: ScoreCheck[],
  note?: string,
): ScoreAxis {
  const verified = items.filter((item) => item.status !== "unverified");
  const raw = verified.reduce((sum, item) => sum + item.score, 0);
  const rawMax = verified.reduce((sum, item) => sum + item.max, 0);
  const total = rescale(raw, rawMax);
  return {
    label,
    total,
    max: 100,
    raw,
    rawMax,
    band: total === null ? null : bandFor(total),
    note,
  };
}

function unverified(
  id: ScoreCheck["id"],
  category: ScoreCheck["category"],
  label: string,
  max: number,
  byPath: ScoreDocuments["byPath"],
  paths: string[],
): ScoreCheck {
  const reason =
    paths
      .map((path) => byPath[path]?.fetchError)
      .find((value) => value) ?? "network error after retries";
  return check({
    id,
    category,
    label,
    max,
    score: 0,
    status: "unverified",
    evidence: `Could not verify — ${reason}`,
  });
}

function probeState(
  byPath: Record<string, ProbeDoc | undefined>,
  paths: string[],
): "found" | "absent" | "unverified" {
  const docs = paths.map((path) => byPath[path]).filter((doc): doc is ProbeDoc => Boolean(doc));
  if (docs.some((doc) => !doc.fetchError && isHttpOk(doc.status) && doc.body.trim())) {
    return "found";
  }
  if (docs.some((doc) => doc.fetchError || doc.status === 0)) {
    return "unverified";
  }
  return "absent";
}

function firstOk(
  byPath: Record<string, ProbeDoc | undefined>,
  paths: string[],
): ProbeDoc | undefined {
  for (const path of paths) {
    const doc = byPath[path];
    if (doc && !doc.fetchError && isHttpOk(doc.status) && doc.body.trim()) {
      return doc;
    }
  }
  return undefined;
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}
