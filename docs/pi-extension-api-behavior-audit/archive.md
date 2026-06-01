# API behavior audit extension archive

Completed or superseded planning docs are indexed here for traceability.

## v0.2.2 versioned planning era

Sealed version docs:

- `versions/0.2.2/index.md`
- `versions/0.2.2/milestones.md`
- `versions/0.2.2/log.md`
- `versions/0.2.2/m1-path-based-passthrough-routes.md`
- `versions/0.2.2/m2-release-prep.md`

## v0.2.1 versioned planning era

Sealed version docs:

- `versions/0.2.1/index.md`
- `versions/0.2.1/milestones.md`
- `versions/0.2.1/log.md`
- `versions/0.2.1/m1-persistent-proxy-window-lifecycle.md`
- `versions/0.2.1/m2-window-comparison-review-integration.md`
- `versions/0.2.1/m3-release-prep.md`

## v0.2.0 versioned planning era

Sealed version docs:

- `versions/0.2.0/index.md`
- `versions/0.2.0/milestones.md`
- `versions/0.2.0/log.md`
- `versions/0.2.0/m1-programmatic-capture-lifecycle.md`
- `versions/0.2.0/m2-headless-automation-runner.md`
- `versions/0.2.0/m3-release-prep.md`

## v0.1.1 versioned planning era

Sealed version docs:

- `versions/0.1.1/index.md`
- `versions/0.1.1/milestones.md`
- `versions/0.1.1/log.md`
- `versions/0.1.1/m1-workspace-path-resolution.md`
- `versions/0.1.1/m2-release-prep.md`

## Initial unversioned planning era through v0.1.0

The root-level milestone docs are sealed as historical after the v0.1.0 MVP baseline. Future product iterations should use `versions/<semver>/`.

Milestone tracker:

- `milestones.md`

Implemented milestone plans:

- `m1-artifact-redaction-primitives.md`
- `m2-layer-a-account-activity-capture.md`
- `m3-scenario-page-manifest.md`
- `m4-layer-b-recording-proxy-spike.md`
- `m5-layer-b-account-activity-integrated-capture.md`
- `m6-artifact-schema-scenario-dictionary.md`
- `m7-tool-based-guided-comparison-workflow.md`
- `m8-generic-scenario-upstream-capture-tools.md`
- `m9-environment-profile-config.md`
- `m10-target-based-capture-guided-ux.md`
- `m11-scenario-discovery-workflow.md`
- `m12-scenario-candidate-generation-validation.md`

Superseded placeholders:

- `m9-scenario-discovery-workflow.md`
- `m10-scenario-discovery-workflow.md`

Supporting docs:

- `roadmap.md`
- `artifact-schema.md`
- `scenario-dictionary.md`
- `evidence-pipeline.md`

## Future archive policy

For future versions, prefer keeping active docs under:

```text
versions/<semver>/
```

When a version is released, mark it complete in `index.md`, append release notes to `log.md`, and add links here. Only move files into deeper archive folders if the directory becomes difficult to navigate.
