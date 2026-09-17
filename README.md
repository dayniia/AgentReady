# AgentReady

A tool that scans a Next.js codebase and generates the files AI agents need to *use* your app — `llms.txt`, MCP tool definitions, and (later) Voxide capabilities. Paste a live URL to get an **Agent Readiness Score**.

This repo is in **V0.3**: scan + classify + generate (V0.1/V0.2), plus a rules-only readiness score for live HTTPS URLs. The headline is **Today's Readiness** (discovery, structured data, raw HTML). **Frontier Score** (MCP / WebMCP / A2A) is shown separately because adoption is still near zero. Voxide dashboard and Person D UI come next. See [Roadmap.md](./Roadmap.md).

## Prerequisites

- Node.js 20+
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/) with **billing disabled** (free tier). Optional for extraction-only scans; required for live classification. Not used by the readiness scorer.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- Scan inspector: [http://localhost:3000/debug/scan](http://localhost:3000/debug/scan)
- Score inspector: [http://localhost:3000/debug/score](http://localhost:3000/debug/score)

## Environment variables

| Name | Required | Notes |
|---|---|---|
| `GEMINI_API_KEY` | For live classification | Server-only. Never import this in client components. |
| `GEMINI_MODEL` | No | Defaults to `gemini-3.5-flash-lite`. |
| `GITHUB_TOKEN` | No | Optional PAT for higher GitHub API rate limits. Public repos work without it. |
| `APP_ORIGIN` | No | CORS allowlist. Defaults to `http://localhost:3000`. |

`.env*` is gitignored. `.env.example` is safe to commit.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm test` | Vitest unit tests (`lib/**/*.test.ts`) |
| `npm run lint` | ESLint |
| `npm run build` | Production build |

## Layout

- `app/` — frontend + API routes
- `lib/core/` — standalone scan/classify module (ingest-agnostic)
- `lib/ingest/` — GitHub fetch, live HTTPS fetch, SSRF
- `lib/generators/` — `llms.txt` / MCP templates
- `lib/score/` — Agent Readiness Score (rules only)
- `fixtures/` — tiny Next.js API samples for tests
- `docs/` — architecture and API contract

## Documentation

- [Roadmap.md](./Roadmap.md) — product stages and roles
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — pipeline and why core is ingest-agnostic
- [docs/API.md](./docs/API.md) — `POST /api/scan` and `POST /api/score`
- [CHANGELOG.md](./CHANGELOG.md)

## Security

- LLM calls go through the Next.js backend only
- Scanned source is secret-stripped before it reaches Gemini
- GitHub ingest is github.com-only; live scoring allows public HTTPS with SSRF checks (no localhost, private IPs, metadata, or non-443 ports)
- Never `eval()` or execute scanned code or scored pages