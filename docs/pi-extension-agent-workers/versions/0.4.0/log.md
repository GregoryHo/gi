# Agent workers v0.4.0 log

Append important planning decisions, milestone starts/completions, verification evidence, and handoff notes here.

## 2026-07-06

- Started v0.4.0 planning on branch `feature/pi-native-agent-worker-adapter` for Phase 4 pi-native sub-agent behavior. M1 is scoped to a pi SDK-backed worker adapter MVP inside `pi-extension-agent-workers`, not a separate sub-agent package.
- Safety direction: `pi-sdk` should be treated as a real worker adapter, require confirmation by default, use bounded child sessions, avoid nested sub-agents and long-lived sessions, and preserve existing workspace collision rules.

## 2026-07-07

- Implemented the main v0.4.0 M1 runtime slices: async/in-memory adapter support, `pi-sdk` adapter creation, public adapter wiring, confirmation-gated safety classification, conservative child-session tool scopes, and async success/failure/cancel/timeout test coverage.
- Updated README, CHANGELOG, orchestration recipes, and M1 docs to describe `pi-sdk` behavior, non-goals, safety boundaries, and usage. M1 remains in progress until final verification, pack dry-run, repo typecheck, load smoke, and optional manual `pi-sdk` smoke are recorded.
- Completed M1 Pi SDK-backed worker adapter MVP. Verification passed: `npm test --workspace @gregho/pi-extension-agent-workers` (127 tests), `npm run typecheck --workspace @gregho/pi-extension-agent-workers`, `npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers` (dry-run tarball included `src/adapters/pi-sdk.ts`), `npm run typecheck`, and `pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"`. Optional manual `pi-sdk` model smoke was not run to avoid invoking model credentials without explicit smoke confirmation.
