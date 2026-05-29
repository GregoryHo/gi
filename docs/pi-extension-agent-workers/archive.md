# Agent workers extension archive

Completed or superseded planning docs are indexed here for traceability.

## v0.3.1 patch planning era

Sealed version docs:

- `versions/0.3.1/index.md`
- `versions/0.3.1/milestones.md`
- `versions/0.3.1/log.md`
- `versions/0.3.1/m1-remove-worker-ui-poc-command.md`

## v0.3.0 versioned planning era

Sealed version docs:

- `versions/0.3.0/index.md`
- `versions/0.3.0/milestones.md`
- `versions/0.3.0/log.md`
- `versions/0.3.0/m1-version-planning-setup.md`
- `versions/0.3.0/m2-workspace-scoped-history.md`
- `versions/0.3.0/m3-original-task-preview-cleanup.md`
- `versions/0.3.0/m4-workspace-scoped-config.md`
- `versions/0.3.0/m5-widget-tui-capability-poc.md`
- `versions/0.3.0/m5-ui-capability-decision.md`
- `versions/0.3.0/m6-worker-ui-direction-implementation.md`
- `versions/0.3.0/m7-custom-profiles-from-config.md`
- `versions/0.3.0/m8-v0.3.0-release-prep.md`

## Initial unversioned planning era through v0.2.0

The root-level milestone docs are sealed as historical after the `0.2.0` local package release. Future product iterations should use `versions/<semver>/`.

Milestone tracker:

- `milestones.md`

Implemented milestone plans:

- `m1-worker-runner-console.md`
- `m2-worker-event-usage-parsing.md`
- `m3-real-worker-cli-adapters.md`
- `m4-worker-invocation-api-profiles.md`
- `m5-llm-tool-facade.md`
- `m6-orchestration-recipes.md`
- `m7-worker-workspace-picker-preflight.md`
- `m7.1-per-run-workspace-assignment.md`
- `m8-v0.1.0-release.md`
- `m9-worker-wait-timeout-rich-summaries.md`
- `m10-run-artifact-index-history.md`
- `m11-expanded-safe-profiles.md`
- `m12-worker-widget-cards.md`
- `m13-bounded-six-worker-dispatch.md`
- `m14-v0.2.0-release.md`

Supporting docs:

- `roadmap.md`
- `orchestration-recipes.md`
- `research.md`

## Future archive policy

For future versions, prefer keeping active docs under:

```text
versions/<semver>/
```

When a version is released, mark it complete in `index.md`, append release notes to `log.md`, and add links here. Only move files into deeper archive folders if the directory becomes difficult to navigate.
