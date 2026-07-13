# Personal pi extensions

This repository contains personal pi extensions and package experiments.

This is a monorepo of independent pi packages. Package versions are independent; see [`docs/release-policy.md`](docs/release-policy.md) for version and tag conventions.

## Packages

- [`packages/pi-extension-plan-mode`](packages/pi-extension-plan-mode/README.md) — safe read-only planning, durable artifacts, and explicit execution handoff.
- [`packages/pi-extension-goal-mode`](packages/pi-extension-goal-mode/README.md) — bounded autonomous goal loops with verification and approval gates.
- [`packages/pi-extension-web-search`](packages/pi-extension-web-search/README.md) — read-only OpenAI/Codex-backed web search, web research, and safe public content fetching for pi.
- [`packages/pi-extension-agent-workers`](packages/pi-extension-agent-workers/README.md) — delegated AI agent worker supervision extension for pi.
- [`packages/pi-extension-subagents`](packages/pi-extension-subagents/README.md) — bounded foreground read-only delegation through Agent Workers.
- [`packages/pi-extension-jira-board`](packages/pi-extension-jira-board/README.md) — Jira Server board/context extension for pi.
- [`packages/pi-extension-api-behavior-audit`](packages/pi-extension-api-behavior-audit/README.md) — planned old/new API behavior audit extension for pi.

## Development

```bash
npm install
npm run typecheck
npm run verify:release # full release gate; does not publish or tag
```

During development, load a package directly with pi:

```bash
pi -e ./packages/pi-extension-web-search
pi -e ./packages/pi-extension-jira-board
pi -e ./packages/pi-extension-agent-workers
pi -e ./packages/pi-extension-api-behavior-audit
```

For persistent local use, install the package path:

```bash
pi install ./packages/pi-extension-web-search
pi install ./packages/pi-extension-jira-board
pi install ./packages/pi-extension-agent-workers
pi install ./packages/pi-extension-api-behavior-audit
```

For Web Search setup, capabilities, limitations, and troubleshooting, start with [`packages/pi-extension-web-search/README.md`](packages/pi-extension-web-search/README.md).
