# Jira board extension log

Append-only history for product/spec/release decisions. Keep entries concise and evidence-oriented.

## 2026-05-22 — v0.1.0 MVP completed

Context:

- Work completed on branch `initial-jira-extension-plan`.
- Package version: `0.1.0`.
- M0-M7 are complete.

Outcome:

- Added self-hosted Jira Server/Data Center pi package scaffold.
- Added env-based Jira config and read-only REST client.
- Added issue/search/snapshot tools.
- Added board widget refresh command.
- Added issue/planning/fix commands.
- Added Jira issue autocomplete.
- Added controlled comment/transition writes with interactive confirmation.
- Added package release polish: README, `.env.example`, `CHANGELOG.md`, `pack:dry-run`.

Verification:

- `npm test --workspace @gregho/pi-extension-jira-board` — 43 tests passed.
- `npm run typecheck --workspace @gregho/pi-extension-jira-board` — passed.
- `npm run typecheck` — passed.
- `npm run pack:dry-run --workspace @gregho/pi-extension-jira-board` — passed; package dry-run contained 15 files.

Next:

- Discuss and create `0.2.0` version docs before new behavior changes.

## 2026-05-22 — v0.1.0 release handoff

Context:

- Documentation governance was added before releasing `0.1.0`.
- `main` was created from the completed `initial-jira-extension-plan` branch because no committed `main` branch existed yet.

Outcome:

- `0.1.0` docs are indexed in `index.md` and `archive.md`.
- Future iteration docs should use `versions/<semver>/`.
- Package source remains at version `0.1.0`.

Verification:

- Full package verification passed before release handoff.

Next:

- Tag `0.1.0` on `main`.
- Discuss and create `0.2.0` specs before new behavior changes.

## 2026-05-22 — v0.2.0 planning opened

Context:

- v0.1.0 is complete.
- User requested v0.2.0 planning focused on onboarding and widget/navigation improvements.

Outcome:

- Created `versions/0.2.0/` planning docs.
- Selected `/jira-onboarding` as the setup command name.
- Planned simple reversible local encryption for Jira password/token storage instead of OS-specific secret stores.
- Planned filterable/pageable project and issue browsing plus card/item-style widget updates.

Next:

- Write a detailed M1 implementation plan before code changes.

## 2026-05-24 — v0.2.0 release handoff

Context:

- v0.2.0 M1-M5 are complete.
- M4 manual smoke testing was accepted by the user.
- M5 automated verification and package dry-run passed.

Outcome:

- `feature/jira-board-v0.2.0-planning` was merged into `main`.
- Package source is at version `0.2.0`.
- Root docs now mark `0.2.0` as the current stable version.
- v0.2.0 docs are indexed in `archive.md`.

Verification:

- `npm test --workspace @gregho/pi-extension-jira-board` — 135 tests passed on `main`.
- `npm run typecheck --workspace @gregho/pi-extension-jira-board` — passed on `main`.
- `npm run typecheck` — passed on `main`.
- `npm run pack:dry-run --workspace @gregho/pi-extension-jira-board` — passed on `main`; package dry-run contained 32 files.

Next:

- Tag `0.2.0` on the final release commit.
