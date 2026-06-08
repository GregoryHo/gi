# M1 — Read-only event trace

## SPEC

### Scope

Implement the smallest useful Agent Lens vertical slice:

- Register read-only pi event observers for agent lifecycle and compaction learning.
- Write local JSONL trace artifacts with one record per observed event.
- Capture event metadata and compact summaries by default, not full raw private content.
- Provide a slash command to show the current trace artifact path and basic capture status.

Target events:

- `before_agent_start` — prompt metadata, system prompt length/hash, context files/skills/tools counts.
- `agent_start` / `agent_end` — run boundaries and message counts.
- `turn_start` / `turn_end` — turn boundaries, assistant stop reason, tool result summaries.
- `context` — message role counts, approximate character counts, first compaction summary presence, no raw content by default.
- `before_provider_request` — provider payload shape summary, no raw payload by default.
- `session_before_compact` — preparation metadata, previous summary length/hash, summarized message counts, split-turn status, `firstKeptEntryId`, `tokensBefore`.
- `session_compact` — final compaction entry metadata, summary length/hash, details keys.

### Non-goals

- No HTML renderer yet; M1 produces JSONL only.
- No raw provider payload capture by default.
- No mutation of system prompt, context messages, provider payloads, compaction output, or session entries.
- No external upload or sharing.
- No custom TUI dashboard.

### Design notes

- Artifact root should default to `.pi-agent-lens/` under the current working directory, with future support for `~/.pi/agent/agent-lens/` if needed.
- JSONL records should be append-only and resilient to process interruption.
- Redaction/truncation helpers should be pure and directly tested.
- Hashes may use Node built-in crypto to correlate content without storing it.
- Use stable event names and schema version fields to support future HTML rendering.

### Expected files

Initial implementation should add only files needed for M1, likely:

```text
packages/pi-extension-agent-lens/src/
  index.ts
  artifacts.ts
  trace.ts
  redact.ts
  summarize.ts
  commands.ts
  *.test.ts
```

Adjust the file list downward if the implementation is simpler.

## AC

Acceptance criteria:

- Loading the package with pi does not change model behavior or provider payload content.
- A user can run pi with the extension and produce a local JSONL trace under `.pi-agent-lens/`.
- Trace records include run/turn/compaction metadata sufficient for a later HTML renderer.
- Default records do not contain full raw prompts, provider payloads, file contents, or tool outputs.
- Compaction records show what was prepared for summarization and what final summary entry was saved, using lengths/hashes/counts by default.
- Command output clearly identifies the trace file path and raw-capture safety status.

Verification commands/checks:

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
```

Manual smoke check:

```bash
pi -e ./packages/pi-extension-agent-lens --no-session "Say hello"
```

Then verify `.pi-agent-lens/` contains a JSONL trace with lifecycle records and no obvious raw private payload dump.

## Status tracking

At start:

1. Change M1 status in `milestones.md` from `Planned` to `In progress`.
2. Append a start entry to `log.md`.

At completion:

1. Run the verification above.
2. Change M1 status in `milestones.md` to `Done`.
3. Add completion notes and verification evidence here.
4. Append a completion entry to `log.md`.

## Completion notes

Implemented M1 as a read-only JSONL trace extension:

- Registered lifecycle observers for agent start/end, turns, context, provider payloads, and compaction events.
- Added `.pi-agent-lens/agent-lens-<timestamp>.jsonl` trace writing.
- Added redacted summaries for prompts, system prompts, messages, provider payload shape, and compaction preparation/final entries.
- Added `/agent-lens` status command showing trace path and raw-capture status.
- Added tests proving redaction avoids raw prompt/context/provider/compaction content by default.

Verification evidence:

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

All listed automated checks passed on 2026-06-07. Initial one-shot manual smoke was not run during M1 implementation, but user completed in-session manual smoke testing before v0.1.0 sealing.

## Status

Done.
