# Web Search 1.0.0 milestones

| Milestone | Status | Plan | Scope |
| --- | --- | --- | --- |
| M1 | Done | `m1-github-clone-usability.md` | Clone/install README, prerequisites, limitations, and troubleshooting docs. |
| M2 | Done | `m2-public-metadata-license.md` | License, package metadata, release-policy table, and public repo hygiene. |
| M3 | Done | `m3-web-search-doctor.md` | `/web-search-doctor` diagnostics command for setup/auth troubleshooting. |
| M4 | Done | `m4-public-release-candidate.md` | Public clone smoke, verification, and release-candidate hardening. |
| M5 | Done | `m5-1.0.0-sealing.md` | Version bump, changelog/docs sealing, and optional package-scoped tag. |

## Status notes

- 2026-06-26: 1.0.0 planning started. Scope is public GitHub clone usability and release hardening, not feature breadth expansion.
- 2026-06-26: M1 started to document clone/install usage, prerequisites, limitations, and troubleshooting.
- 2026-06-26: M1 completed with root/package README updates and verification passing.
- 2026-06-26: M2 started after confirming MIT license and GitHub remote `GregoryHo/gi`.
- 2026-06-26: M2 completed with root MIT license, Web Search package metadata, release-policy update, .gitignore audit, and verification passing.
- 2026-06-26: M3 started with TDD. Initial implementation will add `/web-search-doctor` without optional smoke mode.
- 2026-06-26: M3 completed with redacted diagnostics command, README/CHANGELOG updates, and verification passing.
- 2026-06-26: M4 started after user confirmed `https://github.com/GregoryHo/gi` is public and approved clean clone smoke.
- 2026-06-26: M4 completed with public clean clone at `c429980`, package/root verification, pi load smoke, and `/web-search-doctor` print-mode smoke passing.
- 2026-06-26: M5 started to seal Web Search 1.0.0. Tag creation remains deferred until explicitly requested.
- 2026-06-26: M5 completed with package version `1.0.0`, changelog/docs sealing, archive updates, and verification passing. No tag was created.
