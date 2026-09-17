# Changelog

Format matches the project roadmap: one entry per version bump.

```
## Vx.x — [date]
- What shipped
- What broke / known issues
- What's next
```

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
