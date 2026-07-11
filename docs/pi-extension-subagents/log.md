# Subagents implementation log

- Selected a separate package boundary that reuses Agent Workers as the execution/control plane through a versioned `pi.events` protocol.
- Scaffolded package and documentation governance on `feature/subagents-runtime-facade`.
- Started M1 with strict foreground, read-only, bounded, parallel scope.
- Completed M1 with three built-in read-only agents, strict 1–4 call validation, capability discovery, one confirmation, parallel protocol starts, foreground waits, stable ordered results, and per-call failure isolation.
- Added an in-process registered-tool/protocol integration test. Final verification passed: Agent Workers 143 tests, Subagents 7 tests, root typecheck, both pack dry-runs, style audit, `git diff --check`, and a dual-extension Pi 0.80.6 load smoke.
