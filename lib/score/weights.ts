export const WEIGHTS = {
  llms: 14,
  sitemap: 5,
  robots: 6,
  schema: 12,
  meta: 8,
  mcp: 14,
  openapi: 10,
  webmcp: 8,
  a2a: 3,
  rawHtml: 14,
  landmarks: 6,
} as const;

export const CATEGORY_MAX = {
  1: WEIGHTS.llms + WEIGHTS.sitemap + WEIGHTS.robots,
  2: WEIGHTS.schema + WEIGHTS.meta,
  3: WEIGHTS.mcp + WEIGHTS.openapi + WEIGHTS.webmcp + WEIGHTS.a2a,
  4: WEIGHTS.rawHtml + WEIGHTS.landmarks,
} as const;

export const TODAY_MAX =
  WEIGHTS.llms +
  WEIGHTS.sitemap +
  WEIGHTS.robots +
  WEIGHTS.schema +
  WEIGHTS.meta +
  WEIGHTS.rawHtml +
  WEIGHTS.landmarks;

export const FRONTIER_MAX =
  WEIGHTS.mcp + WEIGHTS.openapi + WEIGHTS.webmcp + WEIGHTS.a2a;

export const TOTAL_MAX = TODAY_MAX + FRONTIER_MAX;
