# Architecture

AgentReady splits **ingest** from the **core pipeline** on purpose. Core never talks to GitHub, Gemini HTTP, or the Next.js UI. A future CLI is: read local files → call the same core → write files to disk.

```
GitHub URL
    → lib/ingest (SSRF allowlist + zipball + route-file filter)
    → SourceFile[]  { filePath, content }
    → lib/core/pipeline
         extractors/nextjs.ts   rules only, no LLM
         secrets.ts             before any model call
         classify.ts            Gemini JSON + Zod
         cache.ts               sourceHash + method + path
    → ClassifiedRoute[]
    → lib/generators (llms.txt, mcp-tools.json, mcp-server.mjs)
    → POST /api/scan  and  /debug/scan (copy + zip)
```

## Core contract

Input:

```ts
type SourceFile = { filePath: string; content: string };
```

Extracted route (rules):

```ts
type Route = {
  filePath: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
  path: string;
  params: Parameter[];
  sourceHash: string;
};
```

Classified route (rules + model):

```ts
type ClassifiedRoute = Route & {
  action_name: string;
  description: string;
  action_type: "read" | "create" | "update" | "delete" | "search" | "other";
  parameters: Parameter[];
  classification_status: "ok" | "unclassified";
};
```

`parameters` on the classified object never include names the extractor did not see. Malformed Gemini JSON becomes `classification_status: "unclassified"` — it is never executed.

## Adding another framework

Write `lib/core/extractors/express.ts` (or similar) that returns `Route[]`. Classification, cache, generators, and the CLI wrapper stay unchanged.

## Adding a CLI later

```ts
const files = readLocalTree(process.cwd());
const routes = await classifySourceFiles(files, { generateJson });
writeOutputs(routes); // Person B generators
```

## Security

- `GEMINI_API_KEY` is server-only (`createGeminiJsonGenerator` in `lib/core/gemini.ts`)
- User URLs are parsed; the fetch target is always `api.github.com` / `codeload.github.com`
- Localhost, private IPs, metadata hosts, and non-GitHub hosts are rejected
- Scanned code is never `eval`'d
- Scan endpoint is rate-limited per IP; CORS is locked to `APP_ORIGIN`
