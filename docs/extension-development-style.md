# Pi extension development style

This document defines the shared architecture and coding style for pi extension packages in this repository.

Use this for implementation structure and code organization. Keep package-specific behavior, product scope, milestones, and domain safety rules in `docs/<package-name>/AGENTS.md` and `packages/<package-name>/AGENTS.md`.

## Architecture pattern

Use a lightweight **Extension Shell + Pure Core + Ports/Adapters** pattern.

The goal is simple testable code, not a heavy framework:

- `src/index.ts` is the extension shell and composition root.
- `commands.ts` and `tools.ts` adapt pi APIs to package behavior.
- Domain logic lives in pure functions where practical.
- External systems are isolated behind small clients/adapters.
- UI/rendering code is kept separate from core behavior once it grows beyond a trivial inline status or notification.

## Default package layout

Prefer this layout for new non-trivial extension packages:

```text
packages/<package-name>/
  AGENTS.md
  README.md
  CHANGELOG.md
  package.json
  tsconfig.json
  src/
    index.ts
    commands.ts
    tools.ts
    config.ts
    types.ts
    <domain>-client.ts
    <domain>-mapper.ts
    <domain>-state.ts
    <domain>-ui.ts
    *.test.ts
```

Use only the files needed by the current milestone. Do not create empty abstraction files just to match the layout.

## Module responsibilities

### `index.ts`

`index.ts` should be a thin composition root:

- export the default pi extension factory,
- initialize small shared dependencies,
- register commands, tools, event handlers, widgets, or autocomplete providers,
- avoid domain logic.

### `commands.ts`

Command modules should:

- register slash commands,
- parse user command args,
- call pure helpers or adapters,
- show compact UI feedback,
- keep session replacement and reload flows explicit.

Do not hide significant behavior in anonymous command handlers when it can be tested as a helper.

### `tools.ts`

Tool modules should:

- define strict TypeBox schemas,
- use `StringEnum` from `@earendil-works/pi-ai` for string enums when needed,
- normalize leading `@` for path-like arguments,
- call pure helpers or adapters,
- return compact LLM-facing content,
- put structured data needed for rendering/state in `details`,
- throw errors to signal failed tool execution.

If a tool mutates files, use `withFileMutationQueue()` around the whole read-modify-write window.

### `config.ts`

Config modules should:

- read credentials from environment variables or ignored local config only,
- validate and normalize config in testable helpers,
- avoid package defaults that encode user-local private paths,
- keep missing-config messages actionable and non-secret.

### Clients/adapters

Clients/adapters should isolate:

- HTTP APIs,
- subprocesses,
- Playwright/browser capture,
- filesystem artifact IO,
- external CLIs.

Core domain functions should not directly depend on env, process execution, network, or pi UI unless the function is explicitly an adapter.

### Mappers and pure core

Mapping and classification logic should be pure where possible:

- raw external payload -> compact internal model,
- artifact schema -> display summary,
- command arg string -> request object,
- tool params -> execution plan.

These functions should have direct unit tests.

## Pi API usage conventions

- Prefer pi extension APIs documented in the installed local pi docs.
- Use `pi.registerTool()` for LLM-callable actions and `pi.registerCommand()` for explicit user commands.
- Use `ctx.hasUI` before relying on interactive UI behavior in contexts that may run in print/JSON/RPC modes.
- Treat `ctx.reload()` as terminal for the current handler: `await ctx.reload(); return;`.
- For async work during active turns, pass `ctx.signal` or the provided tool `signal` when supported.
- In event handlers, avoid assumptions about sibling tool result ordering because tool execution may be parallel.

## LLM-facing output

Tool and command output intended for the model should be compact and provenance-rich:

- prefer summaries, counts, ids, names, statuses, and artifact paths,
- avoid dumping raw API responses, logs, or captured payloads,
- redact secrets before writing artifacts or returning output,
- truncate large output and state where the full artifact/log can be found,
- include enough source/provenance information for follow-up investigation.

## Safety defaults

- Early milestones should be read-only or local-only unless the milestone explicitly says otherwise.
- Write/destructive operations require explicit user confirmation and should provide a preview or dry run where practical.
- Do not commit secrets, credentials, cookies, tokens, raw private payloads, or runtime artifacts.
- Runtime logs/artifacts should go to ignored local directories or `~/.pi/agent/<package-domain>/`.
- External host or project access should be explicit; prefer allowlists for capture/proxy behavior.

## Testing style

Use colocated Node test files:

```text
src/foo.ts
src/foo.test.ts
```

Prefer TDD for:

- config parsing and validation,
- command argument parsing,
- tool parameter helpers,
- redaction,
- mappers/classifiers,
- artifact writers,
- state reconstruction,
- subprocess/event parsing,
- timeout/cancel behavior.

Package verification should normally include:

```bash
npm test --workspace <package-name>
npm run typecheck --workspace <package-name>
npm run pack:dry-run --workspace <package-name>
npm run typecheck
```

Use the actual workspace name from the package `package.json`.

## Package manifest conventions

Extension package `package.json` files should normally include:

- `type: "module"`,
- `main: "src/index.ts"`,
- `exports` pointing to `./src/index.ts`,
- keywords including `pi-package` and `pi-extension`,
- `pi.extensions: ["./src/index.ts"]`,
- scripts: `test`, `typecheck`, `pack:dry-run`,
- pi core imports as `peerDependencies` with `"*"` ranges,
- runtime third-party libraries in `dependencies`.

Include `@earendil-works/pi-tui` only when TUI components are imported.

## Change discipline

- Keep changes aligned to the active milestone SPEC.
- Do not add speculative features or abstractions.
- Match existing package style.
- Remove imports, helpers, and files made unused by your own change.
- Update package docs in the same change when behavior, artifact schemas, safety boundaries, or user workflows change.
