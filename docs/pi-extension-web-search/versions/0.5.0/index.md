# Web Search 0.5.0 planning

## Status

Sealed.

## Goal

Improve HTML extraction quality by adopting Defuddle-inspired article extraction while preserving the package's minimal, read-only, bounded-output safety model.

## Milestones

- M1 — `m1-defuddle-extraction.md`: completed `defuddle/node` primary HTML extraction with local-only parsing and fallback to the existing simple extractor.

## Non-goals

- Browser cookies or authenticated browsing.
- JavaScript rendering.
- PDF/video/GitHub special handling.
- Defuddle async third-party extraction fallbacks.
- Persistent fetched-content storage.
