export function getAttr(tag: string, name: string): string | null {
  const pattern = new RegExp(
    `\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  );
  const match = tag.match(pattern);
  return match?.[2] ?? match?.[3] ?? match?.[4] ?? null;
}

export function visibleText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

export function hasSpaShell(html: string): boolean {
  return /<div\b[^>]*\bid\s*=\s*["'](?:root|app|__next|__nuxt)["'][^>]*>\s*<\/div>/i.test(
    html,
  );
}

export function hasH1(html: string): boolean {
  return /<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(html);
}

export function hasMainLandmark(html: string): boolean {
  return (
    /<(?:main|article)\b/i.test(html) ||
    /<[^>]+\brole\s*=\s*["']main["']/i.test(html)
  );
}

export function pageTitle(html: string): string | null {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const text = match?.[1]?.replace(/\s+/g, " ").trim();
  return text ? decodeEntities(text) : null;
}

export function metaMap(html: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const key = (
      getAttr(tag, "property") ??
      getAttr(tag, "name") ??
      ""
    ).toLowerCase();
    const content = getAttr(tag, "content");
    if (key && content) {
      values.set(key, decodeEntities(content));
    }
  }
  return values;
}

export function jsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  for (const match of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      blocks.push({ __invalid: true });
    }
  }
  return blocks;
}

export function schemaTypes(html: string): string[] {
  const types = new Set<string>();
  for (const block of jsonLdBlocks(html)) {
    collectTypes(block, types);
  }
  for (const match of html.matchAll(
    /\bitemtype\s*=\s*["']https?:\/\/schema\.org\/([^"']+)["']/gi,
  )) {
    if (match[1]) types.add(match[1]);
  }
  return [...types];
}

export function linkRels(html: string): { rel: string; href: string }[] {
  const links: { rel: string; href: string }[] = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = getAttr(match[0], "rel")?.toLowerCase() ?? "";
    const href = getAttr(match[0], "href") ?? "";
    if (rel && href) links.push({ rel, href });
  }
  return links;
}

export function scriptSrcs(html: string): string[] {
  const srcs: string[] = [];
  for (const match of html.matchAll(/<script\b[^>]*>/gi)) {
    const src = getAttr(match[0], "src");
    if (src) srcs.push(src);
  }
  return srcs;
}

function collectTypes(node: unknown, types: Set<string>): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectTypes(item, types);
    return;
  }
  const obj = node as Record<string, unknown>;
  const raw = obj["@type"];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  for (const item of list) {
    const text = String(item);
    const name = text.includes("/") ? text.slice(text.lastIndexOf("/") + 1) : text;
    if (name) types.add(name);
  }
  collectTypes(obj["@graph"], types);
  collectTypes(obj.mainEntity, types);
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}
