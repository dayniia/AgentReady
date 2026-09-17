# API contract

Person B (generators) and Person D (dashboard) should depend on this JSON, not on Gemini or GitHub details.

## `POST /api/scan`

Request:

```json
{ "githubUrl": "https://github.com/owner/repo" }
```

Optional path form: `https://github.com/owner/repo/tree/branch`.

Response `200`:

```json
{
  "repo": { "owner": "dayniia", "repo": "AgentReady", "ref": "main" },
  "routes": [],
  "warnings": [],
  "outputs": [
    { "filename": "llms.txt", "content": "# ..." },
    { "filename": "mcp-tools.json", "content": "{ ... }" },
    { "filename": "mcp-server.mjs", "content": "#!/usr/bin/env node\n..." }
  ]
}
```

Each `routes[]` item is a `ClassifiedRoute`:

| Field | Source | Notes |
|---|---|---|
| `filePath` | extractor | Posix-style path inside the repo |
| `method` | extractor | HTTP method exported by the file |
| `path` | extractor | `/api/bookings/[id]` |
| `params` | extractor | Path/query/body names found in source |
| `sourceHash` | extractor | SHA-256 of file contents |
| `action_name` | Gemini, validated | Fallback name if unclassified |
| `description` | Gemini, validated | Explains the action |
| `action_type` | Gemini, validated | `read` `create` `update` `delete` `search` `other` |
| `parameters` | extractor ∩ Gemini | Never invented by the model |
| `classification_status` | pipeline | `ok` or `unclassified` |

Errors:

| Status | When |
|---|---|
| `400` | Missing `githubUrl`, invalid JSON, or SSRF/allowlist rejection |
| `429` | Per-IP rate limit (10 scans / 10 minutes) |
| `502` | GitHub or Gemini transport failure |

If `GEMINI_API_KEY` is unset, the handler still extracts routes and returns them as `unclassified` with a warning. Generators still run against that shape, but descriptions will be placeholders.

`outputs` is produced by `lib/generators` with no extra Gemini calls. OPTIONS/HEAD routes are omitted from generated files.

## `POST /api/score`

Request:

```json
{ "url": "https://example.com" }
```

HTTPS only. The scorer fetches the page plus a short well-known list (`/llms.txt`, `/robots.txt`, `/sitemap.xml`, MCP/OpenAPI/A2A paths), retrying each fetch up to 3 times with backoff. It does not execute JavaScript and does not call Gemini.

Response `200`:

```json
{
  "url": "https://example.com/",
  "origin": "https://example.com",
  "today": {
    "label": "Today's Readiness",
    "total": 65,
    "max": 100,
    "raw": 42,
    "rawMax": 65,
    "band": "strong"
  },
  "frontier": {
    "label": "Frontier Score",
    "total": 0,
    "max": 100,
    "raw": 0,
    "rawMax": 35,
    "band": "invisible",
    "note": "Emerging standard, near-zero adoption industry-wide. A 0 here is an opportunity, not a failure."
  },
  "total": 65,
  "max": 100,
  "band": "strong",
  "categories": [
    { "id": 1, "name": "Discovery & Manifests", "score": 6, "max": 25 }
  ],
  "checks": [
    {
      "id": "llms",
      "category": 1,
      "label": "llms.txt quality",
      "max": 14,
      "score": 0,
      "status": "fail",
      "evidence": "No llms.txt at /llms.txt or /.well-known/llms.txt",
      "hint": "Publish /llms.txt with a title, a short description of the product, and links to the pages or APIs an agent should use."
    }
  ],
  "warnings": []
}
```

`today` is Discovery + Structured Data + Raw Accessibility, rescaled to 100. `frontier` is Action Exposure (MCP / OpenAPI / WebMCP / A2A), also rescaled to 100. Top-level `total` / `band` alias `today` so existing clients keep a meaningful headline instead of flattening on industry-wide MCP absence.

`band` is `ready` (85+), `strong` (65–84), `partial` (40–64), `weak` (15–39), or `invisible` (0–14). Axis `total` is `null` only when every check on that axis was unverified.

Check `status` is `pass`, `partial`, `fail` (confirmed absence or quality miss), or `unverified` (network error after retries). Unverified checks are excluded from `rawMax` so a timeout is not scored as a missing file. Confirmed `fail` / `partial` checks include a `hint` (what to add). Unverified checks never include a hint — do not recommend adding a file you could not fetch.

Weights before rescaling: Discovery 25, Structured data 20, Raw HTML 20 (`today` = 65). Action exposure 35 (`frontier`).

Errors:

| Status | When |
|---|---|
| `400` | Missing `url`, invalid JSON, or SSRF rejection (localhost, private IP, http, non-443) |
| `429` | Per-IP rate limit (20 scores / 10 minutes) |
| `502` | Homepage not reachable after retries (timeouts, non-2xx). This is not a score of 0. Probe timeouts become `unverified` checks, not a 502. |

## TypeScript import

```ts
import type { ClassifiedRoute } from "@/lib/core";
import type { ScoreResult } from "@/lib/score";
```
