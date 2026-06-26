# Web Search 0.5.2 planning

## Status

Sealed.

## Goal

Make existing web-search/fetch tools more natural-language friendly by guiding the LLM to manage `responseId`, result ids, offsets, and continuation internally instead of asking users to know tool plumbing.

## Milestones

- M1 — `m1-natural-language-retrieval-guidance.md`: completed LLM-facing tool descriptions/guidelines for autonomous search → fetch → continue-reading behavior.

## Non-goals

- New tools.
- Storage changes.
- Extraction changes.
- Network behavior changes.
