# Agent workers extension docs index

## Current stable version

- Version: `0.4.0`
- Package: `packages/pi-extension-agent-workers`
- Status: Released / sealed local package release.
- Version docs: `versions/0.4.0/` is indexed in `archive.md`.
- Current package version: `0.4.0`

## Active planning version

None. Future product iterations should start a new `versions/<semver>/` folder before implementation.

v0.4.0 extends `pi-extension-agent-workers` with a `pi-sdk` adapter while preserving existing worker safety defaults, profile semantics, history/widget behavior, and external CLI adapter support.

v0.3.1 removed the temporary `/worker-ui-poc` runtime command after v0.3.0 promoted the accepted compact card widget direction into the default worker widget, fixed stale `M1 commands` wording, and normalizes orphaned historical active runs as stale failed history so widgets do not show them as indefinitely running.

v0.3.0 delivered a workspace-aware worker control surface:

- Current-workspace scoped history by default with explicit all-workspaces history.
- Original delegated task previews in status/history/widget displays.
- Workspace-scoped safe config for defaults and widget/history preferences.
- Workspace custom profiles from local config with safety validation.
- Widget/TUI capability PoC and compact refreshing default worker widget.

v0.2.0 delivered the reliable multi-worker delegation loop:

- Enforced worker timeouts and wait surfaces.
- Rich compact run summaries.
- Local run artifact indexing and recent history after restart.
- Safe `implementer` and `verifier` profiles.
- Persistent worker widget cards.
- Bounded six-worker dispatch with conservative workspace collision rules.

Future product iterations should use versioned docs under `versions/<semver>/` before implementation starts.

## Navigation

- `roadmap.md` — broad product direction for pi-controlled worker supervision.
- `milestones.md` — historical milestone tracker through `v0.2.0`.
- `archive.md` — completed/superseded docs index, including root-level milestone plans through `v0.2.0`.
- `versions/README.md` — convention for future versioned planning docs.
- `versions/0.4.0/index.md` — active v0.4.0 planning index.
- `versions/0.4.0/milestones.md` — active v0.4.0 milestone tracker.
- `versions/0.4.0/log.md` — v0.4.0 planning/change log.
- `versions/0.4.0/m1-pi-sdk-worker-adapter.md` — pi SDK-backed worker adapter MVP plan.
- `versions/0.3.1/index.md` — sealed v0.3.1 patch planning/release index.
- `versions/0.3.1/milestones.md` — sealed v0.3.1 milestone tracker.
- `versions/0.3.1/log.md` — v0.3.1 planning/change log.
- `versions/0.3.0/index.md` — sealed v0.3.0 planning/release index.
- `versions/0.3.0/milestones.md` — sealed v0.3.0 milestone tracker.
- `versions/0.3.0/log.md` — v0.3.0 planning/change log.
- `orchestration-recipes.md` — copy-pasteable orchestration recipes for generic worker delegation.
- `research.md` — observed worker CLI versions, event-format notes, and parser assumptions.
- `log.md` — append-only product/change log.
- `AGENTS.md` — docs governance and workflow.

## Naming

Chosen package/doc name: `pi-extension-agent-workers`.

Rationale:

- The package is generic worker infrastructure, not a Jira-specific extension.
- The name describes delegated AI agent CLI processes supervised by pi.
- It follows the repo convention where `docs/<package-name>/` exactly matches `packages/<package-name>/`.

## 0.1.0 through 0.4.0 contents

Implemented package capabilities:

- M1-M3 — safe demo runner, event/usage parsing, and explicit Claude Code/Codex CLI adapters.
- M4-M6 — reusable worker request/profile/result/service APIs, LLM-callable tools, and orchestration recipes.
- M7/M7.1 — per-run worker workspace selection and preflight.
- M8 — v0.1.0 release preparation.
- M9-M13 — reliable multi-worker delegation loop improvements.
- M14 — v0.2.0 release preparation.
- v0.3.0 — workspace-scoped history/config, original task previews, custom profiles, UI capability PoC, and compact refreshing default widget.
- v0.3.1 — removed the temporary `/worker-ui-poc` runtime command and PoC-only source, fixed stale command description wording, and normalized stale historical active runs.
- v0.4.0 — added the `pi-sdk` async adapter for local pi SDK child sessions, async adapter runtime support, public adapter wiring, confirmation-gated safety classification, conservative child tool scopes, and manual `pi-sdk` smoke verification.

## Release checklist for 0.4.0

- [x] v0.4.0 M1 complete.
- [x] Package version set to `0.4.0`.
- [x] `CHANGELOG.md` documents `0.4.0`.
- [x] Full post-bump verification passed.
- [x] Release docs mark `0.4.0` as sealed.
