# Plan mode log

## 2026-06-27

- Recorded research and route decision for plan mode, goal/loop mode, and sub-agent/worker mode.
- Created initial `pi-extension-plan-mode` scaffold and M1 spec.
- Decision: implement plan mode before goal/loop mode, and treat existing `pi-extension-agent-workers` as the initial sub-agent/worker substrate.
- M1 implementation started after user approval. Scope remains read-only plan mode only.
- M1 implementation completed with `/plan`, `--plan`, write-tool disabling, conservative bash allowlist, hidden plan instructions, status indicator, and session state restore.
- Verification passed: `npm test --workspace @gregho/pi-extension-plan-mode` (13/13 tests); `npm run typecheck --workspace @gregho/pi-extension-plan-mode`; `npm run pack:dry-run --workspace @gregho/pi-extension-plan-mode`; `npm run typecheck`.
- M2 implementation started after user approval. Scope is plan capture and approval UX only; no execution handoff.
- M2 implementation completed with numbered `Plan:` extraction, captured plan persistence, `/plan-current`, stay/refine/approve UI options, refine follow-up, and approve-to-exit behavior without execution.
- Verification passed: `npm test --workspace @gregho/pi-extension-plan-mode` (20/20 tests); `npm run typecheck --workspace @gregho/pi-extension-plan-mode`; `npm run pack:dry-run --workspace @gregho/pi-extension-plan-mode`; `npm run typecheck`.
- M3 implementation started after user approval. Scope is explicit execution handoff and marker-based progress tracking only; no autonomous loop.
- M3 implementation completed with `/plan-execute`, execute choice in plan capture UX, execution-context injection, `[DONE:n]` marker tracking, progress status/widget, and completion-state persistence.
- Verification passed: `npm test --workspace @gregho/pi-extension-plan-mode` (29/29 tests); `npm run typecheck --workspace @gregho/pi-extension-plan-mode`; `npm run pack:dry-run --workspace @gregho/pi-extension-plan-mode`; `npm run typecheck`.
- M4 completed as a documentation/contract milestone defining plan-mode, future goal-mode, and agent-worker ownership boundaries. No runtime integration was added.
- M4 verification passed: `git diff --check`; `npm run typecheck --workspace @gregho/pi-extension-plan-mode`.
- M5/M6 planning approved by user and documented as separate milestones: M5 for artifact lifecycle/session indexing; M6 for natural-language plan routing.
- M5 implementation started from `/plan-execute`. Scope is artifact lifecycle/session indexing only; M6, goal mode, and worker integration remain out of scope.
- M5 implementation completed with artifact type/storage helpers, durable current pointer/index/artifacts, `/plan-new`, `/plan-history`, `/plan-switch`, `/plan-complete`, `/plan-abandon`, artifact sync from capture/execute/progress, and deterministic recap.
- M5 automated verification passed: `npm test --workspace @gregho/pi-extension-plan-mode` (42/42 tests); `npm run typecheck --workspace @gregho/pi-extension-plan-mode`; `npm run pack:dry-run --workspace @gregho/pi-extension-plan-mode`; `npm run typecheck`. Manual TUI smoke remains pending.
- Fixed M5 progress tracking bug found before smoke testing: execution now scans all assistant messages in an `agent_end` batch for `[DONE:n]` markers instead of only the latest assistant message. Regression verification passed: `npm test --workspace @gregho/pi-extension-plan-mode` (43/43 tests); `npm run typecheck --workspace @gregho/pi-extension-plan-mode`.
- Fixed M5 legacy-session completion bug found during smoke testing: `/plan-complete` and `/plan-abandon` now migrate a restored session-local captured plan into an artifact when no `activePlanId` exists yet. Regression verification passed: `npm test --workspace @gregho/pi-extension-plan-mode` (44/44 tests); `npm run typecheck --workspace @gregho/pi-extension-plan-mode`.
- M6 implementation started from `/plan-execute`. Scope is natural-language plan routing prompt/context only; goal mode, worker integration, artifact storage redesign, and LLM recap remain out of scope.
- M6 implementation completed with `routing.ts`, compact `[ACTIVE PLAN]` hidden context, guarded natural-language routing policy, and prompt-only proposal surfaces that use existing `/plan-new`, `/plan-history`, and `/plan-switch <id>` commands. No goal/worker integration or LLM mutation tools were added.
- M6 automated verification passed: `npm test --workspace @gregho/pi-extension-plan-mode` (49/49 tests); `npm run typecheck --workspace @gregho/pi-extension-plan-mode`; `npm run pack:dry-run --workspace @gregho/pi-extension-plan-mode`; `npm run typecheck`. Manual TUI smoke remains pending.
- Fixed marker parsing bug found during M6 smoke prep: mentioning a marker inside Markdown code, such as `` `[DONE:10]` ``, no longer counts as execution progress. Regression verification passed: `npm test --workspace @gregho/pi-extension-plan-mode` (50/50 tests); `npm run typecheck --workspace @gregho/pi-extension-plan-mode`.
- Renamed unfinished inactive plan disposition from archive/keep inactive to pause, with `paused` plan status. Regression verification passed: `npm test --workspace @gregho/pi-extension-plan-mode` (51/51 tests); `npm run typecheck --workspace @gregho/pi-extension-plan-mode`.

## 2026-07-05

- M7 implementation started after Plan Mode UX feedback. Scope is natural plan recording through a safe `plan_record` tool so users do not need to manually invoke `/plan-new` for ordinary new planning requests. Existing `/plan-new` remains a manual fallback, and active plans still require explicit disposition before replacement.
- M7 implementation completed with `plan_record`, safe active-plan disposition handling, natural routing guidance, completed-plan context filtering, README updates, and temp smoke verification. Verification passed: `npm test --workspace @gregho/pi-extension-plan-mode` (63/63 tests); `npm run typecheck --workspace @gregho/pi-extension-plan-mode`; `npm run typecheck`; temp smoke in `/tmp/pi-plan-natural-flow-smoke` confirmed `plan_control -> plan_record`, `plan_get_current` returned `found:true`, and rollback deleted the fixture.

## 2026-07-06

- Fixed Plan Mode read-only bash allowlist after UX feedback: safe read-only `&&`/`;` chains now pass only when every segment is allowlisted, and `git branch` is limited to no-arg listing or `--show-current` so branch creation remains blocked.
- Regression verification passed: `npm test --workspace @gregho/pi-extension-plan-mode` (64/64 tests); `npm run typecheck --workspace @gregho/pi-extension-plan-mode`; `npm run pack:dry-run --workspace @gregho/pi-extension-plan-mode`; `npm run typecheck`.

## 2026-07-11

- Fixed cross-session current-plan leakage by adding canonical hashed session pointers under `sessions/` while preserving workspace-shared artifacts/history and a legacy `current.json` compatibility mirror.
- Unified session startup, `/plan-current`, and `plan_get_current` around session-local current resolution, including pointer-only crash recovery, missing-artifact fail-closed behavior, ephemeral in-memory state, and terminal-plan restore.
- Regression coverage reached 70 Plan Mode tests. Final verification passed: Plan and Goal package tests/typechecks/pack dry-runs plus root workspace typecheck.
- Isolated real-Pi JSON smoke passed with one shared artifact root and two session directories: session A called `plan_control -> plan_record`, session B called only `plan_get_current` and received `No current plan found`, workspace history retained the session A artifact, and the temporary fixture was deleted.
