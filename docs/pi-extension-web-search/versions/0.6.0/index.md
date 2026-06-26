# Web Search 0.6.0 planning

## Status

Sealed.

## Goal

Add a higher-level natural-language research/read workflow so the model can satisfy common user requests without exposing search result ids, fetch response ids, or offsets.

## Milestones

- M1 — `m1-web-research-tool.md`: completed `web_research({ question })` that searches the web, fetches top sources, stores fetched content, and returns a compact evidence bundle.

## Non-goals

- LLM summarization inside the tool beyond provider search answers and fetched excerpts.
- Persistent storage.
- Browser cookies or JavaScript rendering.
- Replacing low-level `web_search`, `fetch_content`, or `get_search_content`.
