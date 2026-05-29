# API behavior audit extension workflow

This package contains a pi extension for collecting and auditing baseline versus candidate backend API behavior.

## Required reading before work

Before starting any milestone or task in this package:

1. Read `../../docs/pi-extension-api-behavior-audit/AGENTS.md` for docs/spec governance.
2. Read `../../docs/pi-extension-api-behavior-audit/index.md` to identify current status and active planning docs.
3. Read `../../docs/pi-extension-api-behavior-audit/log.md` for recent product decisions.
4. Read the active roadmap/milestone docs linked from `index.md`.
5. Read the current milestone implementation plan before code work.
6. If capture mechanics are unclear, inspect the old/new target projects read-only and record findings in docs before implementing.

## Implementation workflow

Follow the milestone lifecycle defined in `../../docs/pi-extension-api-behavior-audit/AGENTS.md`. This package file only adds implementation-specific constraints:

- Keep changes small and aligned to the active milestone SPEC.
- Do not add features outside the active milestone.
- Prefer TDD for code behavior; at minimum add tests for parsers, redaction, config, artifact writers, and command/tool helpers.
- Run the package verification commands from `README.md` before marking package work complete.

## Evidence pipeline drift discipline

Before changing comparison analysis, scenario suggestion, suggestion validation, scenario dictionary evidence, or report/review interpretation behavior, read `../../docs/pi-extension-api-behavior-audit/evidence-pipeline.md`.

If implementation semantics change, update that document in the same change. Also update:

- `../../docs/pi-extension-api-behavior-audit/artifact-schema.md` for artifact shape changes,
- `../../docs/pi-extension-api-behavior-audit/scenario-dictionary.md` for scenario SOT shape changes,
- deterministic tests for changed classification/suggestion/validation behavior.

## Layer discipline

Keep the Layer A/Layer B distinction explicit in code names, docs, and command help:

- **Layer A** — browser-visible Playwright capture. Useful for MVP validation and page/scenario anchoring.
- **Layer B** — upstream/backend API capture. Required for the final audit goal.

Do not let Layer A artifacts silently stand in for backend behavior parity.

## Safety rules

- Do not commit captured API payloads, cookies, auth headers, tokens, passwords, or production data.
- Default to local services and explicit host allowlists.
- Capture artifacts must be written only to ignored local artifact directories when implemented.
- Redact sensitive headers and body keys before writing artifacts or exposing tool results.
- Destructive scenarios and API writes require explicit user approval before support is added.
- LLM-facing tool output must be compact and provenance-rich; prefer summaries over raw payload dumps.

## Target projects

Known local target paths from the initial exploration:

- Old base: `~/go/src/example.local/source-app`
- Old brand: `~/go/src/example.local/source-brand`
- New candidate: `~/Workspace/Example/Frontend/candidate-1.0/candidate-web-audit`

These paths are user-local assumptions, not portable package defaults. Keep them out of committed runtime defaults except as documentation examples.

## Development verification

From the repo root:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```
