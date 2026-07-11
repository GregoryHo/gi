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
- parallel start and foreground wait;
- stable input-order results;
- explicit confirmation before child execution;
- bounded timeout and turn defaults;
- no nesting, inherited context, background sessions, writes, retries, or team semantics.
