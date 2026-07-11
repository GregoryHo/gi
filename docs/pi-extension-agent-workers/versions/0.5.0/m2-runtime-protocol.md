# v0.5.0 M2 — Versioned worker runtime protocol

## Status

Done.

## SPEC

Expose the existing Agent Workers service as a versioned in-process runtime protocol over `pi.events` so separate packages can reuse one worker execution/control plane without importing the extension runtime or creating another `WorkerManager`.

The initial consumers are the planned `pi-extension-subagents` facade and, later, an Agent Teams coordination package. Goal Mode continues to compose public worker tools and does not require direct protocol coupling.

## Required protocol surface

- Readiness and protocol capability discovery.
- Start one bounded worker request.
- Read status for one run.
- Wait for one run with an optional caller wait limit.
- Cancel one controllable run.
- List available profiles with safety metadata.

Every request must carry a unique correlation id and a supported protocol version. Every response must use a common success/error envelope and preserve compact result semantics without exposing mutable internal run records.

## Design constraints

- One extension-owned `AgentWorkerService` and `WorkerManager` remain the source of truth.
- Protocol handlers must use the same service instance as commands, public `agent_worker_*` tools, history, and widgets.
- Listener registration and disposal must be reload-safe.
- Consumers must receive actionable errors for missing runtime, unsupported protocol version, invalid requests, and response timeout.
- Existing confirmation, workspace validation, collision, timeout, cancellation, history, and artifact policies remain authoritative.
- Prefer official `pi.events`; do not use `globalThis` runtime bridges.

## Non-goals

- No direct `subagent` tool in Agent Workers.
- No agent Markdown discovery or context inheritance policy.
- No shared team task graph, teammate messaging, automatic assignment, or synthesis.
- No protocol operation that bypasses confirmation or workspace safety.
- No cross-process or network RPC.

## Expected files

- `packages/pi-extension-agent-workers/src/protocol/types.ts`
- `packages/pi-extension-agent-workers/src/protocol/server.ts`
- colocated protocol tests
- `packages/pi-extension-agent-workers/src/index.ts` composition wiring
- package README and v0.5.0 docs updates

Exact file splitting may stay smaller if the implementation remains readable and directly testable.

## Acceptance criteria

- Capability discovery reports the supported protocol version and operations.
- Parallel requests resolve only to their matching correlation ids.
- Commands, public tools, and protocol requests observe the same in-memory runs.
- Reload/shutdown does not leave duplicate active listeners.
- Missing runtime, version mismatch, malformed request, handler failure, and caller timeout produce compact deterministic errors.
- Protocol consumers cannot mutate internal worker state or bypass safety gates.
- Tests cover start/status/wait/cancel/profile operations and concurrency correlation.

## Verification

From the repository root:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```

## Completion notes

Completed on `feature/subagents-runtime-facade`.

- Protocol v1 exposes capabilities, start, status, wait, cancel, and list-profile operations over official `pi.events` channels.
- Requests and responses are correlated; parallel requests cannot consume each other's responses.
- The protocol server uses the extension's existing `AgentWorkerService`, so command, tool, widget, history, and protocol consumers share one `WorkerManager`.
- Server registration emits readiness and returns an idempotent listener disposer wired to `session_shutdown`.
- The client boundary provides deterministic `runtime_unavailable` and `response_timeout` failures.
- Start requests require explicit approval when the resolved worker policy requires confirmation.
- Consumers can only narrow authority with `readOnly: true`; they cannot grant write authority beyond existing service policy.
- Protocol results copy compact public data while preserving bounded complete final text and the private full-result path.

Verification passed: 143 package tests, package typecheck, package pack dry-run, and `git diff --check`.
