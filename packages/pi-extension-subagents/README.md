# pi-extension-subagents

A separate pi delegation facade for bounded subagent calls.

## Boundary

- **Subagents** owns the `subagent` tool, built-in agent definitions, delegation input validation, foreground result collection, and presentation.
- **Agent Workers** owns child execution, adapters, lifecycle, safety, concurrency, history, usage, and artifacts.
- **Goal Mode** decides when delegation advances an objective.
- **Agent Teams** remains future coordination work and is not implemented here.

M1 uses Agent Workers protocol v1 over `pi.events`; it does not import or instantiate Agent Workers runtime internals.

## M1 contract

- one foreground `subagent` tool;
- `calls[]` with a maximum of four entries;
- built-in read-only `explorer`, `planner`, and `reviewer` definitions;
- parallel start and foreground wait with compact `started`/terminal progress updates;
- stable input-order results with bounded model-visible final text and private artifact pointers;
- explicit confirmation before child execution;
- parent abort propagation that cancels every started child run through protocol v1;
- bounded timeout and turn defaults;
- no nesting, inherited context, background sessions, writes, retries, or team semantics.

## Install and load

Subagents is independently installable, but it requires the separately installed Agent Workers runtime when the `subagent` tool is invoked. Install/load Agent Workers first so its protocol server is available:

```bash
pi install ./packages/pi-extension-agent-workers
pi install ./packages/pi-extension-subagents

# Or load both for one development run:
pi -e ./packages/pi-extension-agent-workers -e ./packages/pi-extension-subagents
```

If Agent Workers is absent, Subagents loads successfully but `subagent` fails with an actionable tool error before confirmation or child execution.

The tool accepts:

```json
{
  "calls": [
		{ "agent": "explorer", "task": "Locate the relevant implementation and evidence." },
		{ "agent": "reviewer", "task": "Review the same scope for correctness risks." }
  ],
  "cwd": "/path/to/project"
}
```

The batch requires one explicit confirmation, executes calls in parallel, waits in the foreground, and emits compact partial updates as calls start or reach a terminal result. These updates do not create background work. Final results remain input-ordered: each call contributes at most 3,000 characters to a 12,000-character batch response, and complete oversized results remain available through the returned private artifact path. Aborting the parent tool cancels all child runs that have already started.
