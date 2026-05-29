# v0.3.0 M5 — Widget/TUI capability PoC

## Status

Done.

## SPEC

Experimentally determine what pi's widget and TUI APIs can support for worker display/control before committing to a final v0.3.0 worker UI direction.

Questions to answer:

1. Can `ctx.ui.setWidget()` with a component/factory produce a materially better worker layout than string-line cards?
2. Are widget placements limited to above/below editor, and is that sufficient for persistent worker awareness?
3. Can `ctx.ui.custom()` overlay mode provide a usable worker cockpit for inspect/control workflows?
4. Is `ctx.ui.setFooter()` suitable for compact worker status while preserving the default footer information users need?
5. Is a persistent side panel possible through stable public pi APIs? If not, record that limitation explicitly.
6. Which keyboard interactions are practical in custom UI: selection, wait, cancel, log pointer, history scope switch?

Scope:

- Build small, low-risk PoC code or examples behind explicit command(s), not default behavior.
- Prefer throwaway/internal code if that keeps the milestone focused.
- Record findings in a decision note under `versions/0.3.0/`.
- Do not finalize UI direction in this milestone unless the evidence is clear and small.

Possible PoC command names:

- `/worker-ui-poc`
- `/worker-cockpit-poc`

Non-goals:

- No committed large UI rewrite.
- No permanent widget/cockpit behavior unless it is obviously safe and minimal.
- No dependency on private pi internals.

## AC

- PoC exercises native widget, overlay/custom UI, and footer APIs enough to answer the questions above.
- Findings are documented in a decision note.
- The decision note recommends one of:
  - native widget v2
  - overlay cockpit
  - widget + footer hybrid
  - defer custom UI and only improve scoped summaries
- Any PoC runtime surface is safe, explicit, and removable.
- Tests/typecheck pass for any committed PoC code.

Verification:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```

Manual interactive verification is required for this milestone because widget/overlay/footer behavior is TUI-specific.

## Status tracking

At start:

- Mark `v0.3.0 M5` as `In progress` in `versions/0.3.0/milestones.md`.
- Append a start entry to `versions/0.3.0/log.md`.

At completion:

- Mark `v0.3.0 M5` as `Done`.
- Add completion notes here.
- Append verification evidence and decision-note link to `versions/0.3.0/log.md`.

## Current notes

Implemented an explicit, removable PoC command:

- `/worker-ui-poc widget` installs a component/factory-backed worker widget below the editor.
- `/worker-ui-poc wide-widget` installs a width-aware component widget that switches to two-column compact rendering on wide terminals.
- `/worker-ui-poc card-widget` installs an original-widget-inspired bordered card widget showing `adapter`, `profile`, `run id`, `duration`, `task`, and `reason`, refreshing every 5 seconds and using compact two-column layout on wide terminals without a middle divider.
- `/worker-ui-poc footer` installs a custom footer/status PoC.
- `/worker-ui-poc cockpit` opens an overlay custom UI PoC with keyboard handling.
- `/worker-ui-poc sidepanel` opens a right-anchored overlay sidepanel PoC with percentage width, minimum width, max height, and responsive visibility.
- `/worker-ui-poc all` exercises the original widget/footer/cockpit surfaces simultaneously as an intentional clutter/stress test.
- `/worker-ui-poc clear` removes PoC widget/status/footer surfaces.

Each non-clear PoC mode now clears previous PoC widget/status/footer surfaces before installing its own surface so `wide-widget` and `sidepanel` can be evaluated without stale PoC clutter. This does not clear the production/default `agent-workers` widget.

Decision note: `m5-ui-capability-decision.md`.

Manual interactive smoke confirmed that the APIs work, but `/worker-ui-poc all` is visually cluttered when the default widget, PoC widget, custom footer/status, and overlay are all visible at once. That is an explicit M5 finding, not the intended final UX.

Reopened after review: the PoC still needed to specifically answer whether the user's core problem — widget height not being enough, while using available width better — is solvable with component widgets or requires custom overlay UI.

Final manual finding: the original widget structure is good, but the persistent widget needs better width/space use. The accepted PoC direction is `/worker-ui-poc card-widget`: original-style bordered cards, compact fields (`adapter`, `profile`, `run id`, `duration`, `task`, `reason`), 5-second refresh, narrower card width, two-column layout on wide terminals, no middle divider, and truncation for long fields.
