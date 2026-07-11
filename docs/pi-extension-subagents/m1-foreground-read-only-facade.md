# M1 — Foreground read-only delegation facade

## Status

Done.

## SPEC

Register one `subagent` LLM tool that accepts bounded `calls[]`, resolves built-in agent definitions, asks for one explicit confirmation, starts read-only Pi SDK workers through Agent Workers protocol v1, waits in the foreground, and returns stable input-order results.

## Contract

Each call contains:

- `agent`: one of `explorer`, `planner`, or `reviewer`;
- `task`: a non-empty bounded task string.

The request may provide a common `cwd`. M1 accepts one to four calls. Calls start concurrently and results preserve input order.

## Required safety

- Use protocol v1 only; fail clearly when Agent Workers is absent or incompatible.
- Every worker request uses adapter `pi-sdk` and `readOnly: true`.
- Ask once for explicit confirmation before starting children.
- Default each child to 8 turns and 120 seconds.
- Use a bounded protocol response/wait timeout.
- Return compact result metadata and bounded complete final text when available.
- A failed child does not trigger retries or write actions.

## Non-goals

- No nesting or child `subagent` tool.
- No parent transcript/context inheritance.
- No Markdown discovery in M1.
- No persistent or background sessions.
- No write-capable agents.
- No retry/orchestration loop.
- No shared task graph, messaging, assignment, or synthesis.

## Acceptance criteria

- Tool schema exposes a bounded `calls[]` contract accepted by supported providers.
- Invalid/unknown/empty/oversized calls fail before confirmation or worker start.
- Missing/incompatible Agent Workers fails deterministically.
- User rejection starts no workers.
- Approved calls start in parallel with read-only authority and bounded options.
- Foreground waits preserve input order and isolate per-call failures.
- Tests prove no runtime internals are instantiated by Subagents.
- Package tests, typecheck, pack dry-run, root typecheck, and dual-extension smoke pass.

## Completion notes

Completed on `feature/subagents-runtime-facade`.

- Registered one `subagent` tool with a provider-compatible bounded `calls[]` schema.
- Added built-in `explorer`, `planner`, and `reviewer` definitions with read-only prompts, 8-turn limits, and 120-second worker timeouts.
- Runtime capability discovery occurs before confirmation; absent/incompatible Agent Workers fails without starting children.
- One UI confirmation gates the batch. Approved calls start through protocol v1 with `adapter: "pi-sdk"`, `readOnly: true`, and existing Agent Workers confirmation evidence.
- Calls execute concurrently, wait in the foreground, preserve input order, and isolate per-call failures without retry.
- Subagents imports only the Agent Workers protocol subpath and contains no worker manager, adapter, history, or artifact implementation.
- An in-process integration test executes the registered tool through the real event protocol/server boundary and verifies read-only authority plus complete final-result delivery.

Verification passed:

- Agent Workers tests: 143/143.
- Subagents tests: 7/7.
- Root workspace typecheck.
- Both package pack dry-runs.
- Repository extension style audit.
- `git diff --check`.
- Dual-extension Pi 0.80.6 non-interactive load smoke.
