# v0.3.0 M1 — Version planning setup

## Status

Done.

## SPEC

Establish the versioned planning area for `pi-extension-agent-workers` v0.3.0.

Scope:

- Create `docs/pi-extension-agent-workers/versions/0.3.0/`.
- Add version `index.md`, `milestones.md`, and `log.md`.
- Update root `docs/pi-extension-agent-workers/index.md` so the active planning version points to `versions/0.3.0/`.
- Record the agreed v0.3.0 theme and milestone numbering convention.

Non-goals:

- No runtime behavior changes.
- No package version bump.
- No detailed implementation for later milestones.

Expected files:

- `docs/pi-extension-agent-workers/index.md`
- `docs/pi-extension-agent-workers/versions/0.3.0/index.md`
- `docs/pi-extension-agent-workers/versions/0.3.0/milestones.md`
- `docs/pi-extension-agent-workers/versions/0.3.0/log.md`
- `docs/pi-extension-agent-workers/versions/0.3.0/m1-version-planning-setup.md`

## AC

- Root docs identify `0.3.0` as the active planning version.
- Version docs contain an index, milestone tracker, and log.
- Milestones restart at M1 inside the version folder.
- Root v0.2.0 planning docs remain sealed/historical.

Verification:

```bash
test -f docs/pi-extension-agent-workers/versions/0.3.0/index.md
test -f docs/pi-extension-agent-workers/versions/0.3.0/milestones.md
test -f docs/pi-extension-agent-workers/versions/0.3.0/log.md
grep -n "Version: `0.3.0`" docs/pi-extension-agent-workers/index.md
```

## Status tracking

At start:

- Mark `v0.3.0 M1` as `In progress` in `versions/0.3.0/milestones.md`.
- Append a start entry to `versions/0.3.0/log.md`.

At completion:

- Mark `v0.3.0 M1` as `Done` in `versions/0.3.0/milestones.md`.
- Append completion notes to `versions/0.3.0/log.md`.

## Completion notes

Completed as part of v0.3.0 planning setup. Root `index.md` now points at `versions/0.3.0/`, and v0.3.0 has an index, tracker, log, and this milestone plan.
