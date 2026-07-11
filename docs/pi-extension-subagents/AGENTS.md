# pi-extension-subagents documentation rules

- Keep the product boundary explicit: Subagents is a facade; Agent Workers is the execution/control plane; Goal Mode orchestrates; Agent Teams is future coordination.
- Keep roadmap status separate from implementation evidence in `log.md`.
- M1 must remain foreground, read-only, bounded, and parallel.
- Treat nesting, context inheritance, persistent/background sessions, writes, retries, and team semantics as explicit non-goals unless a later milestone activates them.
- Record acceptance criteria and verification commands before marking a milestone done.
