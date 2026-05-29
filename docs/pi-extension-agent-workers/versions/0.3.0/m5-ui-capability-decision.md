# v0.3.0 M5 — Worker UI capability decision note

Status: accepted for M5. Automated/static verification complete and manual interactive TUI smoke completed.

## Evidence gathered

Sources:

- Installed pi docs: `docs/tui.md` and `docs/extensions.md`.
- Explicit PoC command added in this package: `/worker-ui-poc [widget|footer|cockpit|all|clear]`.
- Automated tests exercise the command surface and confirm it calls the public widget, footer/status, and custom overlay APIs without making them default behavior.

## Capability answers

### 1. Can `ctx.ui.setWidget()` with a component/factory produce a better worker layout than string-line cards?

Yes, the public docs show `ctx.ui.setWidget(key, factory, options)` accepts component/factory values in addition to string lines. The PoC uses a component factory and can render worker summaries through a component interface.

Assessment: useful for theming/cache/invalidation and richer rendering, but it is still constrained to vertical widget real estate. It is a good direction for a widget v2 summary, not a full control cockpit.

### 2. Are widget placements limited to above/below editor, and is that sufficient for persistent worker awareness?

The documented stable placements are `aboveEditor` and `belowEditor`. No stable side-panel placement is documented for widgets.

Assessment: above/below editor is sufficient for persistent awareness if the summary stays compact. It is not sufficient for deeper inspection/control without crowding the editor.

### 3. Can `ctx.ui.custom()` overlay mode provide a usable worker cockpit for inspect/control workflows?

Yes, the docs support `ctx.ui.custom(..., { overlay: true, overlayOptions: ... })` with keyboard-handling components. The PoC creates a right-anchored overlay cockpit component with selection and key bindings for intended actions.

Assessment: promising for an explicit `/worker-cockpit`-style command, but should remain on-demand rather than persistent until manually validated for ergonomics.

### 4. Is `ctx.ui.setFooter()` suitable for compact worker status while preserving default footer information?

`ctx.ui.setFooter()` can replace the footer and has access to footer data, but replacing the footer risks hiding default pi information. `ctx.ui.setStatus()` is safer for compact extension status because it appends/publishes extension status in the existing footer.

Assessment: prefer `setStatus()` for persistent worker badges. Use `setFooter()` only for explicit PoC/demo or if M6 has a strong reason to own the whole footer.

### 5. Is a persistent side panel possible through stable public pi APIs?

No stable persistent side-panel API was found. Overlay custom UI can be anchored right-center and sized like a panel, but it is an overlay lifecycle, not a persistent side panel.

Assessment: record side panel as unsupported by stable public APIs for v0.3.0.

### 6. Which keyboard interactions are practical in custom UI?

Practical in `ctx.ui.custom()` components:

- Selection movement: up/down or vim-style `j`/`k`.
- Close: `q` or Escape.
- Intent keys: `w` wait, `c` cancel, `l` log pointer, `h` history scope toggle.

The PoC intentionally records/returns intended actions rather than performing destructive actions. If M6 implements control actions, cancellation must preserve existing safety/confirmation semantics.

## Additional PoC modes

After reopening M5 to focus on the user's core widget height/width concern, the PoC now includes two targeted modes:

- `/worker-ui-poc wide-widget`: component widget that uses the `render(width)` value to switch into a two-column compact layout on wide terminals. This tests whether widget width can be used better even though widget height remains unmanaged by public widget options.
- `/worker-ui-poc card-widget`: original-widget-inspired bordered cards showing compact worker metadata (`adapter`, `profile`, `run id`, `duration`, `task`, `reason`) with a 5-second refresh interval. On wide terminals it renders narrower two-card rows without a middle divider, testing whether the original structure can be kept while improving width/height efficiency.
- `/worker-ui-poc sidepanel`: right-anchored overlay with `width: "38%"`, `minWidth`, `maxHeight: "85%"`, and responsive `visible` behavior. This tests the sidepanel-like route shown in pi's overlay QA examples.

Non-clear modes clear previous PoC widget/status/footer surfaces before installing their own surface. This keeps focused tests from inheriting stale PoC clutter; it intentionally does not clear the production/default `agent-workers` widget.

## Manual smoke findings

The APIs all worked well enough to prove capability:

- Component-backed widget rendered below the editor.
- Footer/status PoC rendered.
- Overlay cockpit opened with worker entries.
- After creating six demo workers, `/worker-ui-poc all` showed all surfaces at once.

Important UX findings:

- **`all` is too visually cluttered**. With the default worker widget, PoC component widget, footer/status, and overlay visible simultaneously, the screen becomes noisy and overlapping in user attention. This strongly argues against a final UX that turns on every surface at the same time.
- The original widget's bordered-card structure is useful, but its current width/height use is inefficient.
- The accepted persistent-widget PoC is `card-widget`: original-style bordered cards, compact worker metadata, smaller card width, two-card rows on wide terminals, no middle divider, field truncation, and 5-second refresh.

## Recommendation for M6

Recommend **card-style compact widget + status, with optional on-demand overlay sidepanel/cockpit**:

1. Promote the `card-widget` layout into the default persistent widget direction: keep the original bordered-card structure, but use narrower compact cards and two-column rendering on wide terminals.
2. Include only compact persistent fields by default: `run id`, `adapter`, `profile`/mode, `duration`, `task`, and `reason`, with truncation.
3. Use `ctx.ui.setStatus()` for a small persistent worker badge (for example active/error counts), not full `setFooter()` replacement. Avoid owning the entire footer by default.
4. Keep overlay sidepanel/cockpit as explicit on-demand detailed UI, not persistent. Overlay can be sidepanel-like; widget placement itself cannot.

## PoC commands for manual smoke

Run in interactive pi with this extension loaded:

```text
/worker-ui-poc widget
/worker-ui-poc wide-widget
/worker-ui-poc card-widget
/worker-ui-poc footer
/worker-ui-poc cockpit
/worker-ui-poc sidepanel
/worker-ui-poc all
/worker-ui-poc clear
```

Expected manual observations:

- `widget`: a component-backed PoC widget appears below the editor.
- `wide-widget`: width-aware summary widget proves `render(width)` can improve layout but is not enough by itself.
- `card-widget`: accepted persistent-widget direction; compact original-style cards with interval refresh.
- `footer`: a PoC footer/status appears; `/worker-ui-poc clear` restores the default footer/status.
- `cockpit`: an overlay appears; `q`/Escape closes; up/down changes selection; `w`, `c`, `l`, `h` return intended action labels.
- `sidepanel`: sidepanel-like right overlay proves detailed UI can escape widget height limits.
- `all`: exercises multiple surfaces as an intentional clutter/stress test.
- `clear`: removes PoC widget/status/footer surfaces.

## Manual verification status

Completed by user interactive smoke. Automated checks verified that the command calls stable public APIs; manual smoke verified that the APIs render, identified that simultaneous all-surfaces mode is not viable final UX, and accepted the compact original-style `card-widget` as the M6 persistent-widget direction.
