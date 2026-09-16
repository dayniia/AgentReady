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
  "warnings": []
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

If `GEMINI_API_KEY` is unset, the handler still extracts routes and returns them as `unclassified` with a warning. Generators can run against that shape, but descriptions will be placeholders.

## TypeScript import

```ts
import type { ClassifiedRoute } from "@/lib/core";
```
