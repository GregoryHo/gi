# API behavior audit extension milestone tracker

| Milestone | Status | Target outcome | Notes |
| --- | --- | --- | --- |
| M0 Initial docs and package scaffold | Done | Repo contains docs/package scaffold and naming decision | Verified package test/typecheck/pack dry run on `feature/api-behavior-audit-extension` |
| M1 Artifact and redaction primitives | Done | Shared sanitized exchange model and artifact writer for Layer A/B | Implemented redaction/types/artifact helpers and tests |
| M2 Layer A account-activity local capture POC | Done | Prove browser-visible request/response capture for `/account/activity` | Manual smoke run `2026-05-25T01-41-13-308Z`; validation layer only |
| M3 Scenario/page manifest | Done | Connect capture runs to page/QA scenario anchors | Built-in/custom manifest smoke passed; run `2026-05-25T03-16-22-781Z` |
| M4 Layer B recording proxy spike | Done | Prove upstream/backend request/response recording without changing product code | Manual curl smoke run `2026-05-25T06-07-45-944Z` |
| M5 Layer B account-activity integrated capture | Done | Use Playwright page actions plus upstream recorder artifacts for account activity | Manual integrated smoke old `2026-05-25T06-58-22-572Z`, new `2026-05-25T06-58-22-580Z` |
| M6 Artifact schema and scenario dictionary governance | Done | Formalize artifact contracts, scenario dictionary SOT, and runtime validators before reports | JSON schemas, default dictionary SOT, and validated loaders implemented |
| M7 Tool-based guided comparison workflow | Done | Register natural-language-triggerable pi tools for scenario listing, run validation, preparation, and account-activity upstream capture | Added four pi tools while preserving slash commands |
| M8 Generic scenario upstream capture tools | Done | Add scenario-id-driven prepare/run tools so capture is not account-activity hard-coded | Added `api_audit_prepare_upstream_capture` and `api_audit_run_upstream_capture` |
| M9 Environment profile config | Done | Store reusable old/new frontend/backend URLs in explicit gitignored local profiles | Added profile commands/tools and profile resolution for generic capture tools |
| M10 Target-based capture model and guided UX | Done | Replace old/new pair assumptions with target-based profiles, N-target capture, and widget-guided setup/capture | Manual testing accepted; full custom overlay setup/capture wizard deferred |
| M11 Scenario discovery evidence collection workflow | Done | Collect clean Layer A/B discovery evidence with persistent proxy, stateful browser, explicit recording windows, and comparison grouping | Manual smoke passed with `account-activity-basic` comparison `comparison-2026-05-26T06-53-01-380Z` |
| M12 Scenario candidate generation and validation | Done | Generate and validate reviewable scenario dictionary candidates or existing-scenario patch suggestions from comparison artifacts | Analysis/suggestion/validation implemented; scenario SOT uses reviewed comparison evidence; evidence pipeline docs/guardrails and local report/review viewers added; no automatic SOT mutation |

## Roadmap status

M0 through M12 are complete for the v0.1.0 MVP. Future work starts after the v0.1.0 release baseline.
