# M2 — Worker event and usage parsing

## Status

Done.

## SPEC

### Scope

Add adapter-level parsing for machine-readable worker output and normalize usage reporting.

Before implementation, record a short research checkpoint with observed worker CLI versions, commands used, and sanitized sample event shapes. Use `research.md` if the findings are more than a few bullets.

M2 should support:

- A shared worker event model for text output, tool/activity events, final messages, usage updates, and errors.
- Adapter parsers for the worker CLIs selected after M1 validation, expected candidates:
  - Claude Code non-interactive stream JSON.
  - Codex CLI `exec --json` JSONL.
- Usage reporting with explicit source:
  - `reported` — parsed from worker machine-readable output.
  - `estimated` — estimated by this extension from available text only when clearly labeled.
  - `unknown` — no reliable source available.
- UI/status display that shows usage source, not just numbers.
- Raw event diagnostics saved only to local artifact paths, not committed fixtures.
- Sanitized parser fixtures that preserve event shape without prompts, secrets, account metadata, or private repository output.

### Non-goals

- No Jira-specific command integration.
- No provider API proxy or billing reconciliation.
- No claim that estimated usage equals provider-billed usage.
- No support for every worker CLI version; document observed versions and fallback behavior.
- No parallel worker dashboard unless required to display M2 data for a single worker.

### Design notes

Suggested normalized shape:

```ts
type WorkerEvent =
  | { type: "output"; stream: "stdout" | "stderr"; text: string; timestamp: number }
  | { type: "activity"; label: string; details?: Record<string, unknown>; timestamp: number }
  | { type: "usage"; usage: WorkerUsage; timestamp: number }
  | { type: "final"; text?: string; timestamp: number }
  | { type: "error"; message: string; timestamp: number };

interface WorkerUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  costUsd?: number;
  source: "reported" | "estimated" | "unknown";
}
```

Adapters should degrade gracefully:

- If JSON parsing fails for a line, treat it as plain output or diagnostic text.
- If usage fields are absent, keep usage source `unknown`.
- If a worker CLI changes event format, tests should fail for the parser fixture rather than silently misreporting usage.
- Document observed CLI versions and fallback behavior before adding or updating parser assumptions.

### Expected files

Likely package files:

- `src/worker-events.ts`
- `src/adapters/claude-code.ts`
- `src/adapters/codex-cli.ts`
- parser tests with sanitized fixtures
- updates to `src/worker-manager.ts` and command rendering from M1
- optional `docs/pi-extension-agent-workers/research.md` for observed CLI event formats

Docs updates at completion:

- `README.md`
- `CHANGELOG.md`
- `docs/pi-extension-agent-workers/milestones.md`
- `docs/pi-extension-agent-workers/log.md`
- optional `docs/pi-extension-agent-workers/research.md` if CLI event formats require notes

## AC

Implementation is complete when:

1. Worker adapters can parse representative sanitized machine-readable output fixtures.
2. Usage is normalized and always includes `source`.
3. Missing usage data is displayed as unknown, not zero.
4. Malformed JSON lines do not crash the worker manager.
5. Status/log output includes useful activity summaries without dumping large raw events.
6. Tests cover reported usage, missing usage, malformed lines, and plain-output fallback.

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

Then run a harmless short task through each implemented adapter and verify status displays usage source correctly.

## Status tracking

At milestone start:

1. Update `docs/pi-extension-agent-workers/milestones.md` status for M2 to `In progress`.
2. Append a start entry to `docs/pi-extension-agent-workers/log.md`.
3. Commit the status/log update before implementation work.

At milestone completion:

1. Run the AC verification commands.
2. Update M2 status to `Done` in `milestones.md`.
3. Add completion notes to this plan if useful.
4. Append verification evidence to `log.md`.
5. Commit the completed milestone state.

## Completion notes

Implemented M2 as parser support and normalization, not as default real worker CLI execution. This keeps M2 safe while proving the event model.

Implemented:

- Shared `WorkerEvent` and expanded `WorkerUsage` model.
- Claude Code `stream-json` parser for sanitized assistant/result/system event shapes.
- Codex CLI `exec --json` JSONL parser for sanitized thread/turn/item event shapes.
- Worker manager support for adapter parsed events, compact activity summaries, final text preview, and reported usage updates.
- Status rendering for reported token/cost fields when present; missing usage remains `source: "unknown"`.
- Malformed JSON line fallback to output events.

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
