# Agent Lens 0.4.1 planning placeholder

## Status

- Version: `0.4.1`
- Status: Deferred placeholder; not active planning.
- Expected base: `0.4.0`
- Theme candidate: Follow-up report UX polish and deferred items from 0.4.0.

## Purpose

This placeholder parks deferred 0.4.x work so 0.4.0 can stay focused on the **Memory-explorer UX bridge**.

0.4.1 should not be implemented until 0.4.0 is sealed and a concrete scope is chosen.

## Candidate scope

Potential 0.4.1 follow-ups:

- Generic static report UX polish not required for 0.4.0 memory-flow reading.
- Index report sorting/filtering improvements.
- Additional density controls if 0.4.0's compact memory view proves useful.
- Section navigation refinements after real 0.4.0 report usage.
- Metadata-only trace comparison if it becomes the next most valuable report-reading workflow.

## Still not automatically in scope

These remain separate product decisions and should not be assumed for 0.4.1:

- Raw capture opt-in implementation.
- Behavior evaluation views or user-authored review labels.
- Automated evaluator/model-judge integration.
- Full replay/eval harness.
- Local server/WebSocket report mode.
- Full session branch tree reconstruction.

## Safety stance

0.4.1 should inherit Agent Lens defaults unless explicitly re-scoped:

- local-only artifacts;
- static-file-first reports;
- no raw private content capture by default;
- no mutation of pi behavior;
- escaped dynamic HTML.
