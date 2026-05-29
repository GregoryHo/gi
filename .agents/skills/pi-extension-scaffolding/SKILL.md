---
name: pi-extension-scaffolding
description: Use when creating or planning a new pi extension package in this repository, especially when scaffolding packages/<name>, docs/<name>, AGENTS.md governance, README, package.json, roadmap, milestones, or milestone plans.
---

# Pi Extension Scaffolding

## Overview

Use this skill to create a new extension package in this repo with the same governance model as the existing packages: root repo rules, package-specific implementation rules, and docs-as-source-of-truth planning.

The default output is a small scaffold plus milestone discussion, not a full implementation.

## Required Reading

Before scaffolding:

1. Read `AGENTS.md` at the repo root.
2. Read `docs/index.md` if it exists.
3. Inspect existing packages under `packages/` for naming and package.json conventions.
4. For pi APIs, read the installed local pi docs referenced by the developer instructions/root AGENTS when relevant, not `docs/` in this repo:
   - `docs/extensions.md`
   - `docs/packages.md`
   - `docs/tui.md` when custom TUI is planned

## Naming Convention

Use one package name everywhere:

```text
packages/<package-name>/
docs/<package-name>/
```

For extension packages, prefer:

```text
pi-extension-<domain>
```

Example:

```text
packages/pi-extension-agent-workers/
docs/pi-extension-agent-workers/
```

In `package.json`, use the scoped npm name:

```json
"name": "@gregho/pi-extension-agent-workers"
```

## Scaffolding Checklist

Create only what is needed for the next milestone.

### Package files

```text
packages/<package-name>/
  AGENTS.md
  README.md
  CHANGELOG.md
  package.json
  tsconfig.json
  src/
    index.ts
```

`package.json` should include:

- `type: "module"`
- `main: "src/index.ts"`
- `exports` for `./src/index.ts`
- `keywords` including `pi-package` and `pi-extension`
- `pi.extensions: ["./src/index.ts"]`
- scripts: `test`, `typecheck`, `pack:dry-run`
- pi packages as `peerDependencies`: `@earendil-works/pi-coding-agent`, `typebox`, and add `@earendil-works/pi-tui` only if TUI components are used

### Docs files

```text
docs/<package-name>/
  AGENTS.md
  index.md
  roadmap.md
  milestones.md
  log.md
  archive.md
  versions/
    README.md
  m1-<topic>.md
```

Use `docs/<package-name>/AGENTS.md` for product/spec governance:

- source-of-truth declaration
- required reading order
- docs file management rules
- versioned planning convention
- milestone lifecycle
- release/sealing workflow
- domain safety rules

Use `packages/<package-name>/AGENTS.md` for implementation workflow:

- required docs to read before package work
- package-specific constraints
- verification commands
- safety rules for runtime behavior

Avoid duplicating the full milestone lifecycle in both files. Put detailed lifecycle rules in docs AGENTS; package AGENTS should link to them and add implementation-specific constraints.

## Milestone Planning Pattern

Before implementation, discuss and write M1/M2 as small milestones.

Each milestone plan needs:

- **SPEC** — scope, non-goals, design notes, expected files.
- **AC** — acceptance criteria and verification commands/checks.
- **Status tracking** — what changes in the active `milestones.md` and `log.md` at start and completion.

Keep early milestones safe by default:

1. M1 should prove the smallest useful vertical slice.
2. M2 should add parsing, persistence, UI, or ergonomics only after M1 is stable.
3. Defer domain integrations until the generic package behavior is proven.

## Versioned Docs Lifecycle

Use the Jira board docs pattern for every non-trivial extension:

- Root `milestones.md` and root `m<N>-<topic>.md` may be used for the initial MVP/release planning era.
- After a version ships, seal it in docs:
  - mark the current stable version in `index.md`
  - clear the active planning version unless the next version has started
  - add completed milestone/plan links to `archive.md`
  - append release/sealing notes to `log.md`
- Future minor versions must plan under `docs/<package-name>/versions/<semver>/` before implementation starts.
- Each active version folder should contain at least:

```text
versions/<semver>/
  index.md
  milestones.md
  log.md
```

Optional version docs include `decisions.md`, dated design notes, and milestone plan files.

Do not keep adding future-version milestones to a sealed root tracker. The root docs should point to the active version folder instead.

## Safety Defaults

For new extensions:

- Do not commit secrets, tokens, raw private payloads, or local-only credentials.
- Prefer read-only or local-only behavior for M1.
- Any write/destructive action must require explicit user confirmation.
- Keep LLM-facing tool output compact and redacted.
- Use ignored local directories or `~/.pi/agent/...` for runtime artifacts.

## Workflow

1. Confirm package name and domain goal with the user.
2. Inspect existing package patterns.
3. Create package/docs scaffold using the 1:1 naming convention.
4. Draft M1/M2 roadmap and milestone plans in the correct planning area: root docs for the initial MVP era, or `versions/<semver>/` for later versions.
5. Stop for user review before implementing runtime behavior.
6. When a version ships, seal the docs by updating `index.md`, `archive.md`, and `log.md` before starting the next version.
7. When implementation starts, follow the package `AGENTS.md` and milestone AC.

## Red Flags

Stop and ask before proceeding if:

- The package name and docs directory name would not match.
- The user asks for implementation before M1 scope and AC are clear.
- A new minor version is being planned in a sealed root tracker instead of `versions/<semver>/`.
- A completed release has no archive/index/log sealing update.
- The first milestone includes external writes, destructive commands, or credential handling without a safety plan.
- Runtime artifacts might be committed to git.
- Token/cost/usage metrics are assumed accurate without an adapter/source that reports them.
