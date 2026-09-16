# Generators

Person B owns this folder (V0.2).

Templates here consume `ClassifiedRoute[]` from `lib/core` and produce:

- `llms.txt`
- MCP tool definitions
- later: Voxide `registerCapability()` boilerplate

No LLM calls in this layer — pure templating off the classified JSON.
