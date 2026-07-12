# Extension improvement waves baseline

Date: 2026-07-12
Branch: `feat/extension-ux-waves`

This document freezes the public command, tool, UI, state, and verification baseline before the cross-extension improvement waves. Wave 0 intentionally changes no production behavior.

## Product boundaries

| Package | Owns | Does not own |
| --- | --- | --- |
| Plan Mode | Read-only planning, plan artifacts, explicit execution handoff, progress markers | Goal loops, worker execution |
| Goal Mode | Bounded objective loop, limits, verification policy, lifecycle control | Plan storage, worker runtime |
| Web Search | Public web search, SSRF-guarded fetch, session-local fetched content | Browser automation, cookies, persistent content |
| Agent Workers | Worker adapters, execution, lifecycle, safety, history, artifacts, runtime protocol | Goal policy, direct subagent UX |
| Subagents | Foreground bounded read-only delegation facade and built-in roles | Worker runtime, writes, background jobs, teams |

## Public surface baseline

| Package | Commands | LLM tools | Persistent/status UI |
| --- | --- | --- | --- |
| Plan Mode | `/plan`, `/plan-current`, `/plan-execute`, `/plan-history`, `/plan-switch`, `/plan-complete`, `/plan-abandon`, `/plan-new`; `--plan` flag | `plan_control`, `plan_get_current`, `plan_record` | Footer mode/progress status; execution-step widget; session entries and local plan artifacts |
| Goal Mode | `/goal`, `/goal-status`, `/goal-pause`, `/goal-resume`, `/goal-stop`, `/goal-step` | `goal_status`, `goal_control`, `goal_start`, `goal_report` | Compact footer status; session entries; done notification |
| Web Search | `/web-search-doctor` | `web_research`, `web_search`, `fetch_content`, `get_search_content` | Command notification only; session-local in-memory result/content stores |
| Agent Workers | `/agent-workers`, `/worker-config`, `/worker-workspace`, `/worker-workspace-pick`, `/worker-run`, `/worker-status`, `/worker-history`, `/worker-wait`, `/worker-log`, `/worker-kill` | `agent_worker_start`, `agent_worker_status`, `agent_worker_list_runs`, `agent_worker_wait`, `agent_worker_cancel`, `agent_worker_list_profiles` | Refreshing worker widget; ignored local run logs/index/config |
| Subagents | None | `subagent` | Tool fallback rendering only; execution delegated through Agent Workers protocol v1 |

## Mode compatibility baseline

| Surface | TUI | RPC | JSON | Print |
| --- | --- | --- | --- | --- |
| Commands without selection/confirmation | Supported | Supported where command invocation is available | No interactive UI | Supported only when handler has textual/stdout fallback |
| Confirmation or selection UI | Supported | Protocol-dependent | Unavailable/fail closed | Unavailable/fail closed |
| Footer status and widgets | Rendered | Status/widget calls may be protocol no-ops | No-op | No-op |
| Custom overlays/components | TUI only | Unsupported/default result | Unsupported | Unsupported |
| LLM tools | Supported | Supported | Supported | Supported, subject to confirmation fail-closed rules |

Any later overlay or shortcut work must preserve a non-TUI textual/tool path.

## Baseline safety contracts

- Plan Mode disables built-in `edit` and `write`, and gates `bash` with a read-only command policy.
- Goal Mode requires per-goal approval for built-in writes and destructive or ambiguous bash; non-UI approval fails closed.
- Web Search accepts public HTTP/HTTPS targets only, validates redirects, limits response size/time, and treats fetched content as untrusted.
- Agent Workers requires confirmation for real adapters, validates cwd, limits concurrency, and blocks colliding write-capable workers.
- Subagents permits 1-4 foreground read-only Pi SDK calls, requires one batch confirmation, and has fixed turn/time limits.

## Compatibility requirements for later waves

1. Existing command names remain callable until an explicit deprecation release.
2. Existing LLM tool names and required parameter shapes remain stable.
3. Agent Workers protocol v1 remains supported; additive fields must not break existing consumers.
4. Existing session/artifact formats remain readable or receive a tested migration.
5. TUI enhancements remain optional and cannot become the only control path.
6. Model-visible output must be bounded and must not expose raw logs or credentials.

## Fresh verification evidence

All package tests passed before production changes:

| Package | Tests |
| --- | ---: |
| Plan Mode | 70/70 |
| Goal Mode | 78/78 |
| Web Search | 39/39 |
| Agent Workers | 144/144 |
| Subagents | 7/7 |

For all five packages:

- package `tsc --noEmit` passed;
- package `npm pack --dry-run` passed.

Root typecheck is reserved for the final cross-package release gate and will also run after each wave that changes shared contracts.

## Wave 0 acceptance and stop decision

Acceptance criteria satisfied:

- Commands, tools, TUI/state surfaces, mode behavior, and package verification are recorded.
- Product boundaries and compatibility constraints are explicit.
- No production source file was changed in Wave 0.
- The baseline test suite is green.

Stop conditions not triggered:

- no pre-existing test failure;
- no uncommitted production change at baseline;
- no unresolved product-boundary ambiguity blocking Wave 1.
