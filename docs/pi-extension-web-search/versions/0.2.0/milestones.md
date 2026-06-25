# Web Search 0.2.0 milestones

| Milestone | Status | Plan | Scope |
| --- | --- | --- | --- |
| M1 | Done | `m1-fetch-content.md` | Add a minimal safe `fetch_content` tool for public HTTP/HTTPS URLs. |

## Status notes

- 2026-06-25: 0.2.0 started after 0.1.0 web-search acceptance. Scope is limited to safe read-only URL fetching, not the full `pi-web-access` suite.
- 2026-06-25: M1 completed with SSRF validation, redirect validation, bounded fetch, compact HTML/text extraction, tool registration, and tests.
