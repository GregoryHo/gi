# Extension improvement waves — completion record

Status: Complete on `feat/extension-ux-waves`.

This record complements the immutable Wave 0 baseline in `extension-improvement-waves-baseline.md`.

## Delivered waves

1. **Baseline** — froze command, tool, TUI, mode, packaging, and non-interactive compatibility contracts.
2. **Delegated results** — exposed bounded Agent Worker and Subagent final results in model-visible tool content, with truncation/artifact fallback and parent-abort cancellation.
3. **Mode and TUI** — added `Ctrl+Alt+P` Plan Mode parity and bounded Plan/Worker widgets for 80, 120, and 160 columns.
4. **Primary commands** — added autocomplete-backed `/plan`, `/goal`, and `/worker` routers while retaining existing slash commands as compatibility aliases.
5. **Goal lifecycle** — aligned command/tool cancellation around active Goal iteration tokens and expanded bounded status detail.
6. **Safety** — changed Plan Mode to a reviewed fail-closed tool allowlist; added Web Search credential/reserved-target checks, redirect-by-redirect DNS validation, socket-level DNS pinning, and a 40,000-character research evidence budget.
7. **Integration** — added root cross-extension contract tests and verified all five packages together.

## Primary human entry points

- `/plan [on|off|status|current|execute|history|switch|new|complete|abandon]`
- `/goal [start|status|pause|resume|stop|cancel|step]`
- `/worker [run|status|history|wait|cancel|log|workspace|config]`

Legacy command names remain registered for compatibility.

## Release gates

The final integration pass requires and passed:

- package tests for Plan Mode, Goal Mode, Web Search, Agent Workers, and Subagents;
- package typechecks and pack dry-runs for all five packages;
- root workspace typecheck;
- root cross-extension contract tests;
- extension style audit and `git diff --check`;
- one process loading all five packages simultaneously in offline, no-session print mode;
- a multi-extension `/web-search-doctor` smoke confirming all four Web Search tools and safety diagnostics.

No package version or release tag is changed by these waves.
