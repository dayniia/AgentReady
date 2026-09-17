import { jsonLdBlocks, metaMap, pageTitle, schemaTypes } from "./html";

const RICH_SCHEMA_TYPES = new Set([
  "Organization",
  "LocalBusiness",
  "Product",
  "Offer",
  "FAQPage",
  "Question",
  "WebSite",
  "SoftwareApplication",
  "Article",
  "NewsArticle",
  "BlogPosting",
  "BreadcrumbList",
  "Person",
  "Event",
  "HowTo",
  "Recipe",
  "Service",
  "JobPosting",
]);

export type SchemaQuality = "none" | "some" | "rich";

export function assessSchema(html: string): {
  quality: SchemaQuality;
  types: string[];
} {
  const types = schemaTypes(html);
  if (types.length === 0) {
    const hasBrokenJsonLd = jsonLdBlocks(html).some(
      (block) =>
        Boolean(block) &&
        typeof block === "object" &&
        "__invalid" in (block as object),
    );
    if (hasBrokenJsonLd) {
      return { quality: "some", types: ["invalid-json-ld"] };
    }
    return { quality: "none", types };
  }
  if (types.some((type) => RICH_SCHEMA_TYPES.has(type))) {
    return { quality: "rich", types };
  }
  return { quality: "some", types };
}

export function assessMeta(html: string): {
  hasTitle: boolean;
  hasDescription: boolean;
  title?: string;
  description?: string;
} {
  const meta = metaMap(html);
  const title =
    nonempty(meta.get("og:title")) ??
    nonempty(meta.get("twitter:title")) ??
    nonempty(pageTitle(html) ?? undefined);
  const description =
    nonempty(meta.get("og:description")) ??
    nonempty(meta.get("twitter:description")) ??
    nonempty(meta.get("description"));
  return {
    hasTitle: Boolean(title),
    hasDescription: Boolean(description),
    title,
    description,
  };
}

function nonempty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
