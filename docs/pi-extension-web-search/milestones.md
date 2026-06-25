# Web Search milestones

## 0.1.0 MVP — active

| Milestone | Status | Plan | Scope |
| --- | --- | --- | --- |
| M1 | Done | `m1-openai-web-search.md` | Package scaffold plus one read-only `web_search` tool backed by OpenAI/Codex web-search capability. |

## Status notes

- 2026-06-25: v0.1.0 scope narrowed away from Google CSE and multi-provider search. M1 targets OpenAI/Codex web-search only, using existing pi/OpenAI subscription auth where possible.
- 2026-06-25: M1 completed with tested OpenAI/Codex auth resolution, Responses API `web_search` request construction, citation parsing, compact tool output, and pi package registration.

## Deferred candidates

Deferred work should be discussed and planned under a future `versions/<semver>/` directory before implementation.

Initial candidates:

- Provider abstraction with Brave, Exa, Tavily, Perplexity, or Gemini.
- Google CSE only if there is a later explicit reason to depend on Google Programmable Search.
- Content fetching with SSRF protection.
- Browser curator UI.
- Search result persistence and retrieval.
