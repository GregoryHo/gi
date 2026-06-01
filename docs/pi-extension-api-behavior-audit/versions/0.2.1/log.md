# API behavior audit v0.2.1 log

- Started v0.2.1 on branch `feature/api-behavior-audit-0.2.1-persistent-proxy-windows` after merging v0.2.0 to `main` via fast-forward commit `2caf7a12`.
- Started M1 persistent proxy/window lifecycle. Added failing tests first for proxy sessions that keep sockets alive while recording windows finalize independently.
- Implemented initial `ProxySessionRegistry` and exposed tools for persistent proxy sessions and recording windows. Focused verification passed for core/tool tests and package typecheck.
- Completed M2 window comparison/review integration. Stopping a recording window writes an `api-behavior-comparison-run` v1 artifact under `comparisons/<comparisonRunId>.json`, returns `comparisonPath`, and tool output displays the path for follow-up `/api-discovery-analyze` or `api_audit_review_capture` usage.
- Started M3 v0.2.1 release prep: version/changelog/docs sealing and verification, with no publish or tag.
- Completed and sealed v0.2.1 local package release. Package version/lockfile/changelog updated to `0.2.1`, root/version docs archived and sealed, release policy updated, and verification passed: package version check, package test, package typecheck, package pack dry run, and root typecheck. No publish or tag was created.
