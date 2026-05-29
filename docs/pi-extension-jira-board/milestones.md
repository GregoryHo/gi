# Jira board extension milestone tracker

> v0.1.0 MVP is complete. Historical implementation plans are retained in place and indexed in `archive.md`. For new product iterations, use versioned docs under `versions/<semver>/` and update `index.md`.

| Milestone | Status | Target outcome | Notes |
| --- | --- | --- | --- |
| M0 Initial plan and scaffold | Done | Repo contains package scaffold and roadmap | Current branch: `initial-jira-extension-plan` |
| M1 Read-only Jira config and client | Done | Connect to Jira and validate config | Implemented env config, read-only client, `/jira-status` |
| M2 Agent tools for issue/search context | Done | LLM can fetch compact issue/search info | Implemented `jira_get_issue` and `jira_search_issues` |
| M3 Board and sprint snapshot widget | Done | Widget displays active board/sprint summary | Implemented `jira_board_snapshot` and `/jira-refresh` |
| M4 Planning commands | Done | `/jira-plan` and `/jira-fix` generate structured prompts | Implemented `/jira-issue`, `/jira-plan`, `/jira-fix` |
| M5 Autocomplete and UX polish | Done | Fast issue key insertion and better commands | Implemented Jira issue autocomplete and README polish |
| M6 Optional controlled Jira writes | Done | Comments/transitions with confirmation | Implemented confirmed `/jira-comment` and `/jira-transition` |
| M7 Packaging polish | Done | Package is installable/reusable | Released local package milestone `0.1.0` |

## Roadmap status

M0-M7 are complete for the initial local package milestone. M6 introduced controlled Jira writes with confirmation. Future work should start from a new milestone/plan before adding behavior.
