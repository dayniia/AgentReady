import { describe, expect, it } from "vitest";
import { assessLlmsTxt } from "./llms";
import { assessRobotsTxt } from "./robots";
import { scoreDocuments } from "./score";
import { assessSchema } from "./structured";
import type { ScoreDocuments } from "./types";
import { TOTAL_MAX, WEIGHTS } from "./weights";

const POPULATED_LLMS = `# Example Shop

Example Shop is a demo storefront that lets agents search inventory and create bookings.

- [Search](https://shop.example/search)
- [Bookings](https://shop.example/bookings)
- [API](https://shop.example/api)
`;

function page(
  html: string,
  extra: Record<string, string> = {},
): ScoreDocuments {
  const origin = "https://shop.example";
  const byPath: ScoreDocuments["byPath"] = {};
  for (const [path, body] of Object.entries(extra)) {
    byPath[path] = {
      requestedUrl: `${origin}${path}`,
      finalUrl: `${origin}${path}`,
      status: 200,
      contentType: "text/plain",
      body,
    };
  }
  return {
    targetUrl: `${origin}/`,
    homepage: {
      requestedUrl: `${origin}/`,
      finalUrl: `${origin}/`,
      status: 200,
      contentType: "text/html",
      body: html,
    },
    byPath,
  };
}

describe("weights", () => {
  it("sums to 100", () => {
    expect(TOTAL_MAX).toBe(100);
    expect(
      WEIGHTS.llms +
        WEIGHTS.sitemap +
        WEIGHTS.robots +
        WEIGHTS.schema +
        WEIGHTS.meta +
        WEIGHTS.mcp +
        WEIGHTS.openapi +
        WEIGHTS.webmcp +
        WEIGHTS.a2a +
        WEIGHTS.rawHtml +
        WEIGHTS.landmarks,
    ).toBe(100);
  });
});

describe("assessLlmsTxt", () => {
  it("treats missing, stub, and populated files differently", () => {
    expect(assessLlmsTxt(undefined)).toBe("missing");
    expect(assessLlmsTxt("llms.txt")).toBe("stub");
    expect(assessLlmsTxt(POPULATED_LLMS)).toBe("populated");
  });
});

describe("assessRobotsTxt", () => {
  it("allows a missing file and blocks GPTBot sitewide Disallow", () => {
    expect(assessRobotsTxt(undefined).level).toBe("allow");
    expect(
      assessRobotsTxt("User-agent: GPTBot\nDisallow: /").level,
    ).toBe("block");
    expect(
      assessRobotsTxt("User-agent: *\nDisallow: /").level,
    ).toBe("block");
    expect(
      assessRobotsTxt("User-agent: *\nDisallow: /llms.txt").level,
    ).toBe("block");
    expect(
      assessRobotsTxt("User-agent: *\nDisallow:\n").level,
    ).toBe("allow");
  });
});

describe("assessSchema", () => {
  it("scores none, some, and rich structured data", () => {
    expect(assessSchema("<html></html>").quality).toBe("none");
    expect(
      assessSchema(
        `<script type="application/ld+json">{"@type":"Thing"}</script>`,
      ).quality,
    ).toBe("some");
    expect(
      assessSchema(
        `<script type="application/ld+json">{"@type":"Organization","name":"Shop"}</script>`,
      ).quality,
    ).toBe("rich");
  });
});

describe("scoreDocuments", () => {
  it("scores a fleshed-out agent-ready page near the top of the range", () => {
    const html = `<!doctype html>
<html>
  <head>
    <title>Example Shop</title>
    <meta name="description" content="Book widgets and search inventory." />
    <meta property="og:title" content="Example Shop" />
    <meta property="og:description" content="Book widgets and search inventory." />
    <script type="application/ld+json">{"@type":"Organization","name":"Example Shop"}</script>
  </head>
  <body>
    <main>
      <h1>Example Shop</h1>
      <p>${"Agents can search inventory and create bookings. ".repeat(6)}</p>
      <script>navigator.modelContext = { tools: [] }</script>
    </main>
  </body>
</html>`;

    const result = scoreDocuments(
      page(html, {
        "/llms.txt": POPULATED_LLMS,
        "/sitemap.xml": `<?xml version="1.0"?><urlset><url><loc>https://shop.example/</loc></url></urlset>`,
        "/robots.txt": "User-agent: *\nAllow: /\n",
        "/.well-known/mcp.json": `{"mcpVersion":"1.0","transport":"sse","endpoint":"https://shop.example/mcp"}`,
        "/openapi.json": `{"openapi":"3.1.0","info":{"title":"Shop","version":"1"},"paths":{}}`,
        "/.well-known/agent.json": `{"name":"Example Shop","url":"https://shop.example"}`,
      }),
    );

    expect(result.today.total).toBe(100);
    expect(result.frontier.total).toBe(100);
    expect(result.total).toBe(100);
    expect(result.band).toBe("ready");
    expect(result.checks.every((item) => item.status === "pass")).toBe(true);
  });

  it("gives a stub llms.txt far fewer points than a populated one", () => {
    const html = `<html><head><title>x</title></head><body><div id="root"></div></body></html>`;
    const stub = scoreDocuments(page(html, { "/llms.txt": "hello" }));
    const missing = scoreDocuments(page(html));
    expect(stub.checks.find((item) => item.id === "llms")?.score).toBe(5);
    expect(missing.checks.find((item) => item.id === "llms")?.score).toBe(0);
    expect(missing.today.total).toBeLessThan(20);
    expect(missing.frontier.total).toBe(0);
    expect(missing.checks.find((item) => item.id === "openapi")?.status).toBe(
      "fail",
    );
  });

  it("treats an empty SPA shell as a raw-content failure without zeroing robots", () => {
    const result = scoreDocuments(
      page(`<html><body><div id="root"></div></body></html>`),
    );
    expect(result.checks.find((item) => item.id === "rawHtml")?.score).toBe(0);
    expect(result.checks.find((item) => item.id === "robots")?.score).toBe(6);
  });

  it("does not treat a timed-out probe as a confirmed absence", () => {
    const docs = page(
      `<html><head><title>Shop</title><meta name="description" content="A shop for agents to browse products and book widgets." /></head><body><main><h1>Shop</h1><p>${"Hello from the server-rendered homepage. ".repeat(8)}</p></main></body></html>`,
      { "/llms.txt": POPULATED_LLMS },
    );
    docs.byPath["/sitemap.xml"] = {
      requestedUrl: "https://shop.example/sitemap.xml",
      finalUrl: "https://shop.example/sitemap.xml",
      status: 0,
      contentType: "",
      body: "",
      fetchError: "Timeout contacting shop.example",
    };
    docs.byPath["/openapi.json"] = {
      requestedUrl: "https://shop.example/openapi.json",
      finalUrl: "https://shop.example/openapi.json",
      status: 0,
      contentType: "",
      body: "",
      fetchError: "Timeout contacting shop.example",
    };
    const result = scoreDocuments(docs);
    expect(result.checks.find((item) => item.id === "sitemap")?.status).toBe(
      "unverified",
    );
    expect(result.checks.find((item) => item.id === "openapi")?.status).toBe(
      "unverified",
    );
    expect(result.today.rawMax).toBe(60);
    expect(result.today.total).toBeGreaterThanOrEqual(75);
    expect(result.checks.find((item) => item.id === "openapi")?.score).toBe(0);
    expect(result.frontier.rawMax).toBe(25);
    expect(result.checks.find((item) => item.id === "sitemap")?.hint).toBeUndefined();
    expect(result.checks.find((item) => item.id === "llms")?.hint).toBeUndefined();
    expect(result.checks.find((item) => item.id === "openapi")?.hint).toBeUndefined();
  });

  it("attaches a fix hint to confirmed gaps, not to timeouts", () => {
    const missing = scoreDocuments(
      page(`<html><head><title>x</title></head><body><div id="root"></div></body></html>`),
    );
    expect(missing.checks.find((item) => item.id === "llms")?.hint).toMatch(
      /llms\.txt/,
    );
    expect(missing.checks.find((item) => item.id === "rawHtml")?.hint).toMatch(
      /Server-render/,
    );
    expect(missing.checks.find((item) => item.id === "mcp")?.hint).toMatch(/MCP/);
  });
});
