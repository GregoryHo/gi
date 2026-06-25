# Web Search extension workflow

This package contains a pi extension for read-only web search.

## Required reading before work

Before starting any milestone or task in this package:

1. Read `../../docs/pi-extension-web-search/AGENTS.md` for docs/spec governance.
2. Read `../../docs/pi-extension-web-search/index.md` to identify current status and active planning docs.
3. Read `../../docs/pi-extension-web-search/log.md` for recent product decisions.
4. Read the active milestone plan before code work.
5. If pi extension APIs, provider auth, tool schema behavior, or model registry access are unclear, inspect the installed local pi docs and examples before implementing.

## Implementation workflow

- Keep changes small and aligned to the active milestone SPEC.
- Do not add features outside the active milestone.
- Prefer pure helpers for query normalization, source parsing, output formatting, and auth-route classification.
- Keep external network/provider behavior isolated behind small adapters.
- Run the package verification commands from `README.md` before marking package work complete.

## Web-search safety rules

- The extension must be read-only with respect to local/project state.
- Do not store API keys, auth headers, cookies, browser profile data, raw provider payloads, or private response bodies.
- Do not implement browser-cookie access without a future explicit safety milestone.
- Tool output and details must not include secrets.
- Keep LLM-facing output compact and source-provenance rich.

## Development verification

From the repo root:

```bash
npm test --workspace @gregho/pi-extension-web-search
npm run typecheck --workspace @gregho/pi-extension-web-search
npm run pack:dry-run --workspace @gregho/pi-extension-web-search
npm run typecheck
```
