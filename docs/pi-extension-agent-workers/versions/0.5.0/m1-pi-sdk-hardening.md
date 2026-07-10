# v0.5.0 M1 — Pi SDK hardening and boundary tests

## Status

Proposed.

## SPEC

Harden the v0.4.0 `pi-sdk` worker adapter so pi-native sub-agent runs are safer and easier to diagnose, without expanding the scope into a general multi-agent platform.

## Required hardening candidates

### 1. Child turn/budget limits

Add an explicit child-session turn or budget limit in addition to the existing worker timeout. If the current pi SDK does not expose an exact turn-limit primitive, document the limitation and implement the safest available fallback, such as:

- bounded prompt/run lifecycle;
- clear timeout defaults;
- compact terminal status reason;
- no automatic retry loop.

Acceptance checks:

- Tests cover a bounded child-session termination path when possible.
- Timeout remains distinct from cancellation.
- The worker summary explains the terminal reason compactly.

### 2. Testable child resource boundary

Make the minimal child resource loader policy explicit and test-covered.

Required defaults:

- no `agent_worker_*` tools in child sessions;
- no project-local child extension discovery;
- no nested worker/sub-agent delegation by default;
- no inherited prompts/skills unless explicitly designed later.

Acceptance checks:

- Tests assert the child resource loader returns no extensions/tools/skills/prompts by default.
- Docs state how a future controlled inheritance feature would need explicit design before implementation.

### 3. Observability and failure shaping

Improve compact status/log behavior for SDK setup and child prompt outcomes.

Acceptance checks:

- Tests cover setup failure.
- Tests cover prompt failure.
- Tests cover missing final text while preserving `usage.source: unknown` when usage is absent.
- Public tool/status summaries remain compact and do not expose raw child event payloads.

### 4. Conservative model/profile option pass-through

If practical in the pi SDK, support only narrow option pass-through needed for worker profiles, such as model hints or injected system prompt text. Do not expose broad provider configuration through generic worker requests.

Acceptance checks:

- Tests cover supported pass-through fields.
- Unsupported fields are ignored or rejected clearly.
- Existing profiles remain safe by default.

### 5. Cross-mode orchestration guidance

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

## Initial implementation stance

This milestone should start with tests and small changes. If a hardening item requires uncertain SDK behavior or broad API design, document the limitation and defer rather than forcing speculative implementation.
