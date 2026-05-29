# Agent workers research

## 2026-05-25 — M2 worker CLI event-format checkpoint

Purpose: record observed worker CLI versions, commands, event-shape assumptions, and fallback behavior before implementing M2 parsers.

### Commands run so far

No model/task execution has been run in this checkpoint yet. The following inspection commands only checked local CLI availability, versions, and help text:

```bash
command -v claude
claude --version
claude --help | grep -Ei 'json|stream|print|output|verbose'
command -v codex
codex --version
codex --help | grep -Ei 'json|exec|output|stream|schema'
codex exec --help | grep -Ei 'json|output|stream|schema|last-message'
```

### Observed local CLIs

- Claude Code
  - Path: `/Users/gregho/.local/bin/claude`
  - Version: `2.1.150 (Claude Code)`
  - Relevant help flags observed:
    - `-p, --print`
    - `--output-format text|json|stream-json`
    - `--input-format text|stream-json`
    - `--include-partial-messages`
    - `--include-hook-events`
    - `--max-budget-usd <amount>`
    - `--no-session-persistence`
- Codex CLI
  - Path: `/opt/homebrew/bin/codex`
  - Version: `codex-cli 0.132.0`
  - Relevant help flags observed:
    - `codex exec`
    - `codex exec --json`
    - `codex exec --output-schema <FILE>`
    - `codex exec -o, --output-last-message <FILE>`

### Sanitized event-shape samples

Approved short model tasks were run. Raw output was saved only under `/tmp/agent-workers-m2-research/` and must not be committed.

Commands run:

```bash
claude -p --verbose --no-session-persistence --output-format stream-json --max-budget-usd 0.01 "Reply with OK only."
codex exec --json "Reply with OK only."
```

Outcomes:

- Claude Code emitted newline-delimited JSON stream events, then exited non-zero because `--max-budget-usd 0.01` was too low. The stream still included assistant/result event shapes and reported usage fields. Do not record raw cost values in committed docs/fixtures.
- Codex CLI exited successfully and emitted JSONL events with reported token usage.

Sanitized Claude Code `stream-json` shapes observed:

```jsonl
{"type":"system","subtype":"hook|init","session_id":"<redacted>","uuid":"<redacted>","hook_event":"<optional>","hook_name":"<optional>","exit_code":"<optional>","stdout":"<optional>","stderr":"<optional>","output":"<optional>"}
{"type":"assistant","session_id":"<redacted>","uuid":"<redacted>","request_id":"<redacted>","parent_tool_use_id":null,"message":{"type":"message","role":"assistant","model":"<model>","content":[{"type":"text","text":"<redacted>"}],"usage":{"input_tokens":0,"output_tokens":0,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"cache_creation":{"ephemeral_5m_input_tokens":0,"ephemeral_1h_input_tokens":0},"service_tier":"<redacted>","inference_geo":"<redacted>"}}}
{"type":"result","subtype":"success|error_max_budget_usd","is_error":false,"session_id":"<redacted>","uuid":"<redacted>","stop_reason":"end_turn","num_turns":1,"total_cost_usd":0,"usage":{"input_tokens":0,"output_tokens":0,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"iterations":1,"server_tool_use":{},"service_tier":"<redacted>","inference_geo":"<redacted>","speed":0},"modelUsage":{"<model>":{"inputTokens":0,"outputTokens":0,"cacheReadInputTokens":0,"cacheCreationInputTokens":0,"costUSD":0}}}
```

Sanitized Codex CLI `exec --json` shapes observed:

```jsonl
{"type":"thread.started","thread_id":"<redacted>"}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"<redacted>","type":"agent_message","text":"<redacted>"}}
{"type":"turn.completed","usage":{"input_tokens":0,"cached_input_tokens":0,"output_tokens":0,"reasoning_output_tokens":0}}
```

Sanitization rules for fixtures:

- Remove prompts, final answer text beyond placeholders, account metadata, sensitive paths, session/thread ids, request ids, and raw cost/account values.
- Preserve field names and nested structure needed by parsers.
- Usage fields above are treated as CLI-reported usage when present.

### Parser assumptions to verify before implementation

- Claude Code parser should handle newline-delimited `stream-json` events and keep usage `unknown` unless a reported usage object is present on assistant/result events.
- Claude Code parser should map `message.content[].text` to final/output text and map `system` events to activity diagnostics without exposing raw hook payloads by default.
- Codex CLI parser should handle JSONL from `codex exec --json` and keep usage `unknown` unless a reported usage object is present on `turn.completed`.
- Codex CLI parser should map `item.completed` with `item.type = "agent_message"` to final/output text.
- Malformed JSON lines must be treated as plain output or diagnostics, not fatal parser errors.
- Missing usage must mean `source: "unknown"`, not zero tokens/cost.

### Fallback behavior

- If a CLI is unavailable, the adapter/parser tests should still run against sanitized fixtures.
- If an observed event format changes, fixture parser tests should fail rather than silently misreport usage.
- If usage fields are absent or ambiguous, report `usage.source = "unknown"`.
