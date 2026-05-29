# Jira board extension v0.2.0 roadmap

## Product direction

v0.2.0 focuses on usability after the v0.1.0 MVP:

1. Make Jira setup interactive and safer by default.
2. Make Jira context easier to browse inside pi.
3. Improve the widget from a minimal summary to a useful compact context panel.

## Roadmap

### Phase 1 — Onboarding foundation

Build `/jira-onboarding` and encrypted local config first, because project/issue browsing depends on users being able to configure Jira without shell env friction.

Key decisions:

- Use local reversible encryption with Node `crypto`.
- Store non-secret config separately from encrypted secret blobs.
- Keep env vars as overrides.
- Use masked UI for secret entry.

### Phase 2 — Query model

Add project and issue query primitives that support filters and paging while retaining compact, bounded LLM-facing outputs.

Key decisions:

- Treat Jira Server/Data Center compatibility as a constraint.
- Prefer paged APIs when available, with safe fallback behavior.
- Keep issue descriptions omitted by default in list contexts.

### Phase 3 — Interactive navigation and widget polish

Use pi's custom UI support for interactive browsing and `setWidget()` for persistent context display.

Key decisions:

- Widget is primarily a read-only context cockpit, not a clickable Jira client.
- Browser UI handles interaction, filter selection, paging, and issue focus.
- Issue filtering should use a faceted browser: choose filter type, then choose actual values.
- Raw JQL remains an advanced escape hatch, not the default UX.
- First faceted implementation should use project versions/components API plus issue result aggregation.
- A fuller Jira metadata system is optional and deferred to M3.2.
- Card/item layout should degrade gracefully on narrow terminals.

## Risks

- Simple local encryption protects against accidental plaintext exposure but not full local compromise.
- Jira Server/Data Center project listing APIs may vary by version.
- Custom TUI components can grow complex; keep the first version narrow.
- Widget card layouts must stay compact to avoid crowding the editor.

## Open questions

- Should selected project/board be saved globally, per working directory, or only in session state?
- Should `/jira-onboarding` include project/board selection in M1, or should that move to M3 browser UI?
- Should the browser be split into `/jira-projects` and `/jira-issues`, or combined as `/jira-browse`?
