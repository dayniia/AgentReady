# Generators

Pure templating. No LLM calls. Input is `ClassifiedRoute[]` from `lib/core`.

| File | Output |
|---|---|
| `llms-txt.ts` | `llms.txt` |
| `mcp.ts` | `mcp-tools.json` plus a runnable `mcp-server.mjs` |
| `index.ts` | `generateOutputs(routes, { title })` |

HEAD/OPTIONS routes are omitted. Duplicate `action_name`s get a method/path suffix.

Voxide capability output is deferred (V0.5).
