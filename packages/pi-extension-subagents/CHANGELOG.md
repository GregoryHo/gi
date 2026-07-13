# Changelog

## 0.2.0 - 2026-07-13

### Added

- Added compact foreground partial updates as bounded subagent calls start and reach terminal results, without adding background execution semantics.

## 0.1.0 - 2026-07-12

### Added

- Initial package and governance scaffold for a separate Subagents delegation facade over Agent Workers protocol v1.
- Added the foreground `subagent` tool with bounded parallel `calls[]`, built-in explorer/planner/reviewer definitions, explicit confirmation, read-only Pi SDK requests, ordered complete results, and per-call failure isolation.
- Added bounded model-visible per-agent results and parent-abort cancellation for every started child through Agent Workers protocol v1.
