# Changelog

Format matches the project roadmap: one entry per version bump.

```
## Vx.x — [date]
- What shipped
- What broke / known issues
- What's next
```

## V0.3 — 2026-09-17

- What shipped: Agent Readiness Score for a live HTTPS URL. Headline is **Today's Readiness** (discovery + structured data + raw HTML, rescaled to 100). **Frontier Score** (MCP / OpenAPI / WebMCP / A2A) is separate and labeled as an emerging standard. Live fetches retry 3 times with backoff; timeouts are `unverified` ("Could not verify"), not the same as confirmed absence. Confirmed gaps include a `hint` (what to add); timeouts do not. `POST /api/score` and `/debug/score`. Rules only (no Gemini). Stub `llms.txt` scores lower than a populated one.
- What broke / known issues: WebMCP is static-HTML detection only (no JS runtime); live scoring is public HTTPS:443 with SSRF checks; inspector UI is `/debug/score` until Person D's dashboard. Top-level `total` now aliases Today's Readiness, not the old blended 100.
- What's next: V0.6 demo booking app (V0.4/V0.5 Voxide skipped). Person D landing page in parallel.

## V0.2 — 2026-09-17

- What shipped: Tool now generates llms.txt and MCP tool definitions automatically, with copy-paste and zip-download delivery. Also emits a runnable `mcp-server.mjs` (stdio JSON-RPC) from the same classified JSON — no extra Gemini calls.
- What broke / known issues: Delivery UI lives on `/debug/scan` until Person D's dashboard; OPTIONS/HEAD routes are omitted from generated files; Voxide capability output is still deferred.
- What's next: V0.3 Agent Readiness Score (parallel). Voxide dashboard is later.

## V0.1.4 — 2026-09-17

- What shipped: Default model is `gemini-3.5-flash-lite` (higher free-tier quota). Classification uses at most two compact batch calls and stops immediately on HTTP 429 instead of retrying each remaining route.
- What broke / known issues: If you already burned the `gemini-3.5-flash` free-tier budget this minute, wait a minute after restarting the dev server.
- What's next: V0.2 generators (`llms.txt` / MCP) consume `ClassifiedRoute[]`.

## V0.1.3 — 2026-09-17

- What shipped: Classify all extracted routes in one Gemini batch (with per-route retry), looser action_type aliases, and a Notes column for unclassified rows.
- What broke / known issues: Workspace scans include `fixtures/` demo APIs as well as `/api/scan`.
- What's next: V0.2 generators (`llms.txt` / MCP) consume `ClassifiedRoute[]`.

## V0.1.2 — 2026-09-17

- What shipped: Default Gemini model is `gemini-3.5-flash` (`gemini-2.0-flash` was shut down). Classification errors now appear in route descriptions and scan warnings instead of failing silently. Failed Gemini calls are not cached.
- What broke / known issues: Restart `npm run dev` after changing `GEMINI_MODEL` in `.env.local`.
- What's next: V0.2 generators (`llms.txt` / MCP) consume `ClassifiedRoute[]`.

## V0.1.1 — 2026-09-17

- What shipped: GitHub URL parser accepts `owner/repo`, quotes, and trailing punctuation. If Node's HTTPS fetch times out, ingest falls back to `git clone`. Debug page can scan this workspace without GitHub.
- What broke / known issues: Direct `fetch()` to api.github.com still hits a 10s connect timeout on some networks; git/workspace paths work around it.
- What's next: V0.2 generators (`llms.txt` / MCP) consume `ClassifiedRoute[]`.

## V0.1 — 2026-09-17

- What shipped: Core scanning pipeline working end-to-end — extracts routes from a Next.js GitHub repo and classifies each into a structured action description using Gemini. Public GitHub URL ingest, secret stripping, Zod validation, scan API, and `/debug/scan` inspector.
- What broke / known issues: in-memory cache and rate-limit (reset on deploy); public repos only; App Router `route.ts` + Pages API only; no zip upload; classification skipped (with warning) if `GEMINI_API_KEY` is unset.
- What's next: V0.2 generators (`llms.txt` / MCP) consume `ClassifiedRoute[]` from `POST /api/scan`.

## Unreleased
