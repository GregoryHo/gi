# M3 — Real worker CLI adapters

## Status

Done.

## SPEC

### Scope

Connect the M1 worker runner and M2 parsers to real local worker CLI processes while keeping execution safe and opt-in.

M3 should support:

- Real worker adapters for locally installed CLIs:
  - `claude-code` using Claude Code non-interactive `stream-json` output.
  - `codex-cli` using Codex CLI `exec --json` JSONL output.
- `/worker-run --adapter claude-code <task>` and `/worker-run --adapter codex-cli <task>` after explicit adapter selection.
- One running worker at a time, preserving the M1 lifecycle model.
- stdout/stderr/raw machine-readable output captured only in local artifact paths.
- M2 parser integration for activity summaries, final text preview, and reported usage.
- Status output that distinguishes `reported` usage from `unknown` usage.
- CLI availability and version checks that fail with clear user-facing messages.
- Safe default invocation flags:
  - no dangerous permission bypass flags
  - no sandbox bypass defaults
  - no arbitrary shell interpolation
  - no parallel write-capable execution

### Non-goals

- No Jira-specific delegation commands.
- No worktree automation unless explicitly added by a later milestone.
- No multi-worker dashboard.
- No cloud orchestration.
- No billing reconciliation or exact cost claims beyond CLI-reported fields.
- No automatic destructive/write mode beyond what the selected worker CLI normally does in the current cwd.
- No hidden use of project-local prompts or credentials beyond the worker CLI's normal local configuration.

### Design notes

Adapter invocation should be explicit and inspectable. Prefer direct executable + argv arrays with `shell: false`.

Suggested command shapes are provisional:

```text
/worker-run --adapter claude-code <task>
/worker-run --adapter codex-cli <task>
```

Potential Claude Code argv shape, subject to verification against local CLI docs/help:

```text
claude -p --verbose --no-session-persistence --output-format stream-json <task>
```

Potential Codex CLI argv shape, subject to verification against local CLI docs/help:

```text
codex exec --json <task>
```

Open design question before implementation:

- Should real adapters require an extra confirmation before first use in a pi session because worker CLIs may read/write the current working tree under their own policy?

Default answer should bias toward safety: if confirmation is added, keep it small and explicit.

### Expected files

Likely package files:

- `src/adapters/claude-code-runner.ts` or extend `src/adapters/claude-code.ts`
- `src/adapters/codex-cli-runner.ts` or extend `src/adapters/codex-cli.ts`
- updates to `src/commands.ts`
- updates to `src/worker-manager.ts` if spawn specs need adapter metadata
- tests for argv construction, CLI availability handling, parser wiring, and safe defaults

Docs updates at completion:

- `README.md`
- `CHANGELOG.md`
- `docs/pi-extension-agent-workers/milestones.md`
- `docs/pi-extension-agent-workers/log.md`
- update `research.md` if observed invocation behavior changes

## AC

Implementation is complete when:

1. A user can start a real Claude Code worker with explicit `--adapter claude-code` when the CLI is available.
2. A user can start a real Codex CLI worker with explicit `--adapter codex-cli` when the CLI is available.
3. Real worker stdout/stderr/event streams are captured only to local artifacts.
4. M2 parsers update status with activity, final preview, and reported usage when the CLI emits usage.
5. Missing usage remains `source: "unknown"`.
6. CLI unavailable/version failures are shown clearly and do not crash pi.
7. Adapter argv construction uses explicit args and `shell: false`.
8. Dangerous sandbox/permission bypass flags are not enabled by default.
9. Tests cover argv construction, parser wiring, unavailable CLI handling, and usage source behavior.

Verification commands:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
```

Manual smoke check:

```bash
pi -e ./packages/pi-extension-agent-workers
```

Then run harmless short tasks through each implemented real adapter and verify status/log output. Use explicit low-cost prompts and avoid committing raw outputs.

## Status tracking

At milestone start:

1. Update `docs/pi-extension-agent-workers/milestones.md` status for M3 to `In progress`.
2. Append a start entry to `docs/pi-extension-agent-workers/log.md`.
3. Commit the status/log update before implementation work.

At milestone completion:

1. Run the AC verification commands.
2. Update M3 status to `Done` in `milestones.md`.
3. Add completion notes to this plan if useful.
4. Append verification evidence to `log.md`.
5. Commit the completed milestone state.

## Completion notes

Implemented real worker CLI adapters for explicit Claude Code and Codex CLI runs.

Implemented:

- `claude-code` adapter using `claude -p --verbose --no-session-persistence --output-format stream-json <task>`.
- `codex-cli` adapter using `codex exec --json <task>`.
- CLI availability validation before spawning.
- Confirmation gate for real adapters in UI, with `--yes` for non-UI automation.
- Safe argv construction with `shell: false` and no dangerous bypass flags.
- M2 parser wiring for activity, final preview, and reported usage status.
- One-running-worker lifecycle remains unchanged.

Manual smoke evidence from pi interactive testing:

- `claude-code` run completed with `exitCode: 0`, `usage.source: reported`, activity summary, and `final: OK`.
- `codex-cli` run completed with `exitCode: 0`, `usage.source: reported`, activity summary, and `final: OK`.
- Raw logs remained under `~/.pi/agent/agent-workers/runs/<id>/` and were not committed.

Verification completed with:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
```

A non-interactive load smoke check also exited successfully:

```bash
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```
