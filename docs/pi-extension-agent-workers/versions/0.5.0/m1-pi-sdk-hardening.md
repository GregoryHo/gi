# v0.5.0 M1 — Pi SDK hardening and boundary tests

## Status

Done.

## SPEC

Harden the v0.4.0 `pi-sdk` worker adapter so pi-native worker runs produce usable bounded deliverables, respect supported child options, and remain safe and diagnosable, without expanding the scope into direct sub-agent UX or a general multi-agent platform.

## Required hardening candidates

### 1. Bounded complete child results

Replace preview-only child deliverables with a bounded complete result contract. Preserve oversized full output in a private runtime artifact and return its path alongside an explicit truncation notice.

Acceptance checks:

- Tests prove a normal child answer is available beyond the current short preview.
- Tests prove oversized output is truncated for the caller and preserved in a private artifact.
- Compact status/widget surfaces may continue using previews, but wait/result consumers can access the bounded deliverable.

### 2. Child turn/budget limits

Add an explicit child-session turn or budget limit in addition to the existing worker timeout. If the current pi SDK does not expose an exact turn-limit primitive, document the limitation and implement the safest available fallback, such as:

- bounded prompt/run lifecycle;
- clear timeout defaults;
- compact terminal status reason;
- no automatic retry loop.

Acceptance checks:

- Tests cover a bounded child-session termination path when possible.
- Timeout remains distinct from cancellation.
- The worker summary explains the terminal reason compactly.

### 3. Testable child resource boundary

Make the minimal child resource loader policy explicit and test-covered.

Required defaults:

- no `agent_worker_*` tools in child sessions;
- no project-local child extension discovery;
- no nested worker/sub-agent delegation by default;
- no inherited prompts/skills unless explicitly designed later.

Acceptance checks:

- Tests assert the child resource loader returns no extensions/tools/skills/prompts by default.
- Docs state how a future controlled inheritance feature would need explicit design before implementation.

### 4. Observability and failure shaping

Improve compact status/log behavior for SDK setup and child prompt outcomes.

Acceptance checks:

- Tests cover setup failure.
- Tests cover prompt failure.
- Tests cover missing final text while preserving `usage.source: unknown` when usage is absent.
- Public tool/status summaries remain compact and do not expose raw child event payloads.

### 5. Conservative profile option pass-through

Pass supported profile instructions as the child session's actual system prompt rather than embedding them as user-task text. If practical in the pi SDK, also support narrow model and thinking-level hints. Do not expose broad provider configuration through generic worker requests.

Acceptance checks:

- Tests cover supported pass-through fields.
- Unsupported fields are ignored or rejected clearly.
- Existing profiles remain safe by default.

### 6. Cross-mode orchestration guidance

Document when to choose `pi-sdk` vs `claude-code` vs `codex-cli`, especially in Plan Mode and Goal Mode flows.

Acceptance checks:

- Recipes include Plan artifact → Goal loop → worker delegation → `pi-sdk` backend.
- Recipes warn that write-capable `pi-sdk` runs still require confirmation and workspace collision safety.

## Non-goals

- No nested sub-agents.
- No long-lived child sessions.
- No automatic child extension/tool inheritance.
- No cloud execution.
- No automatic write authority beyond existing worker safety rules.
- No multi-agent swarm/coordinator runtime.
- No raw child transcript exposure in compact LLM-facing summaries.
- No direct `subagent` tool, agent-definition discovery, or Agent Teams semantics in this package.

## Initial implementation stance

This milestone should start with tests and small changes. If a hardening item requires uncertain SDK behavior or broad API design, document the limitation and defer rather than forcing speculative implementation.

## Completion notes

Completed on `feature/subagents-runtime-facade`.

- Pi SDK child final text is preserved as a bounded complete in-memory result; oversized full output remains in the private run log with an explicit path.
- Profile instructions are passed as the actual child system prompt for `pi-sdk` instead of being embedded in user task text.
- Exact `provider/model-id`, thinking level, and per-run max-turn options pass through to the child session.
- Pi SDK children default to 20 turns and terminate with the distinct `turn_limit` reason when exceeded; timeout and cancellation remain separate manager outcomes.
- The minimal child resource loader is directly tested to expose no extensions, skills, prompts, themes, context files, or nested Agent Workers tools.
- Setup failure, prompt failure, missing final/usage, successful final/usage, cancellation, timeout, and turn-limit behavior have automated coverage.
- The repository runtime uses `@earendil-works/pi-coding-agent` 0.75.4, which lacks the newer runtime `resolveCliModel` export; model pass-through therefore uses conservative exact `ModelRegistry.find(provider, model-id)` resolution.

Verification passed: 134 package tests, package typecheck, and `git diff --check`.
