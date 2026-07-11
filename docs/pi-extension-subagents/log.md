# Subagents implementation log

- Selected a separate package boundary that reuses Agent Workers as the execution/control plane through a versioned `pi.events` protocol.
- Scaffolded package and documentation governance on `feature/subagents-runtime-facade`.
- Started M1 with strict foreground, read-only, bounded, parallel scope.
