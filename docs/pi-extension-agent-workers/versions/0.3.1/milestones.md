# Agent workers v0.3.1 milestones

| Milestone | Status | Goal | Notes |
| --- | --- | --- | --- |
| M1 Remove worker-ui-poc command, stale historical running display, and patch release | Done | Remove temporary PoC command surface, normalize stale historical active runs, and ship patch metadata/docs | Plan: `m1-remove-worker-ui-poc-command.md` |

## Completion criteria

- `/worker-ui-poc` is no longer registered or listed in help/README.
- PoC-only runtime source is no longer packaged.
- Historical active runs from interrupted/reloaded sessions display as stale failed history rather than indefinitely running.
- Package metadata reports `0.3.1`.
- Verification passes.
