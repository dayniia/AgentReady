# Changelog

Format matches the project roadmap: one entry per version bump.

```
## Vx.x — [date]
- What shipped
- What broke / known issues
- What's next
```

## V0.1 — 2026-09-17

- What shipped: Core scanning pipeline working end-to-end — extracts routes from a Next.js GitHub repo and classifies each into a structured action description using Gemini. Public GitHub URL ingest, secret stripping, Zod validation, scan API, and `/debug/scan` inspector.
- What broke / known issues: in-memory cache and rate-limit (reset on deploy); public repos only; App Router `route.ts` + Pages API only; no zip upload; classification skipped (with warning) if `GEMINI_API_KEY` is unset.
- What's next: V0.2 generators (`llms.txt` / MCP) consume `ClassifiedRoute[]` from `POST /api/scan`.

## Unreleased
