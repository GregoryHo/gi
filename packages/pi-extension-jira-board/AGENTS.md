# Jira board extension workflow

This package contains a pi extension for self-hosted Jira Server/Data Center board and issue context.

## Required reading before work

Before starting any milestone or task in this package:

1. Read `../../docs/pi-extension-jira-board/AGENTS.md` for docs/spec governance.
2. Read `../../docs/pi-extension-jira-board/index.md` to identify the current active version.
3. Read `../../docs/pi-extension-jira-board/log.md` for recent product/release context.
4. Read the active version roadmap/milestone docs linked from `index.md`.
5. Read the current milestone implementation plan before code work.
6. If API behavior is unclear, read `../../docs/pi-extension-jira-board/api-reference-notes.md` before guessing.

## Implementation workflow

Follow the milestone lifecycle defined in `../../docs/pi-extension-jira-board/AGENTS.md`. This package file only adds implementation-specific constraints:

- Keep changes small and aligned to the active milestone SPEC.
- Do not add features outside the active milestone.
- Keep Jira write behavior aligned with the documented safety boundaries.
- Run the package verification commands from `README.md` before marking package work complete.

## Safety rules

- Do not commit Jira credentials, URLs that reveal private infrastructure, tokens, passwords, cookies, or captured raw Jira payloads.
- Read credentials only from environment variables or ignored local config.
- Initial milestones are read-only. Any future write operation must require explicit user confirmation and should include a dry-run preview.
- Keep LLM-facing tool output compact. Prefer mapped summary objects over raw Jira API responses.

## API reference

The extension targets:

- Core REST API: `/rest/api/2`
- Agile API: `/rest/agile/1.0`
- Auth: Basic auth via username/email plus token/password

When implementation details are unclear, compare against `api-reference-notes.md` and the referenced tracker-jira plugin before changing design.
