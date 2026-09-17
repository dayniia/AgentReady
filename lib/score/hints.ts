export const ABSENCE_CHECK_IDS = new Set([
  "llms",
  "sitemap",
  "mcp",
  "openapi",
  "webmcp",
  "a2a",
]);

export const CHECK_HINTS: Record<
  string,
  Partial<Record<"fail" | "partial", string>>
> = {
  llms: {
    fail: "Publish /llms.txt with a title, a short description of the product, and links to the pages or APIs an agent should use.",
    partial:
      "Expand the stub llms.txt: add a real description and at least a few resource links.",
  },
  sitemap: {
    fail: "Add /sitemap.xml (a urlset or sitemapindex with at least one <loc>).",
  },
  robots: {
    fail: "Allow AI crawlers (GPTBot, ClaudeBot, Google-Extended) in robots.txt. Do not Disallow / or /llms.txt for them.",
    partial:
      "Some AI crawlers are allowed and others are blocked — make the policy consistent if you want agents to read the site.",
  },
  schema: {
    fail: "Add JSON-LD Schema.org on the homepage (Organization, WebSite, or SoftwareApplication with a name).",
    partial: "Enrich the JSON-LD: use a specific type and a name, not a bare Thing.",
  },
  meta: {
    fail: "Add a <title> and a meta description (Open Graph tags help too).",
    partial: "Add the missing title or description so agents can name the page.",
  },
  mcp: {
    fail: "Expose an MCP server at /.well-known/mcp.json when you want agents to call tools — still rare industry-wide.",
    partial: "The MCP path returned JSON that does not look like a manifest. Add mcpVersion, transport, or tools.",
  },
  openapi: {
    fail: "Publish an OpenAPI spec at /openapi.json (or link rel=\"service-doc\") so agents can see concrete operations.",
    partial: "The page hints at Swagger/OpenAPI, but no spec was found at the usual paths.",
  },
  webmcp: {
    fail: "Declare tools in static HTML (WebMCP) if this page is meant to expose in-browser agent actions.",
    partial: "A script URL looks MCP-related; add a static tool declaration if agents should use this page.",
  },
  a2a: {
    fail: "Add /.well-known/agent.json if you want A2A agent-card discovery.",
  },
  rawHtml: {
    fail: "Server-render meaningful text. An empty SPA shell is invisible to most agents (they do not run your JavaScript).",
    partial: "Increase the amount of visible text in the raw HTML so a non-JS client can understand the page.",
  },
  landmarks: {
    fail: "Wrap primary content in <main> (or <article>) and include one <h1>.",
    partial: "Add the missing <h1> or <main>/<article> landmark.",
  },
};
