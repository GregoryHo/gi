# Release and tag policy

This repository is a private monorepo for multiple independent pi packages.

## Version ownership

- The root package `gregho-pi-extensions` is a private workspace container and does not represent a product release version.
- Each package under `packages/<package-name>/` owns its own `package.json` version.
- Package versions may move independently. Do not infer repository release state from one package's version.

Current package versions:

| Package | Current version | Notes |
| --- | ---: | --- |
| `@gregho/pi-extension-plan-mode` | `0.2.1` | Read-only planning, artifacts, execution handoff, and consolidated command UX |
| `@gregho/pi-extension-goal-mode` | `0.2.0` | Bounded goal lifecycle, verification, and tool-based orchestration |
| `@gregho/pi-extension-web-search` | `1.1.1` | OpenAI/Codex-backed read-only web search and safe public content fetching |
| `@gregho/pi-extension-agent-workers` | `0.6.0` | Pi SDK-backed worker adapter for local pi-native child sessions |
| `@gregho/pi-extension-subagents` | `0.2.0` | Foreground bounded read-only delegation over Agent Workers protocol v1 |
| `@gregho/pi-extension-jira-board` | `0.2.0` | Jira board/context extension |
| `@gregho/pi-extension-agent-lens` | `0.5.0` | Multi-agent swimlane and partial topology foundation |
| `@gregho/pi-extension-api-behavior-audit` | `0.2.2` | Local path-based passthrough routing patch for legacy proxy compatibility |

## Tag naming

Use package-scoped tags when tagging package releases:

```text
pi-extension-jira-board/v0.2.0
pi-extension-agent-workers/v0.1.0
pi-extension-api-behavior-audit/v0.1.0
```

Do not use bare repository-global semver tags such as:

```text
0.1.0
0.2.0
v0.1.0
```

Bare semver tags are ambiguous in this monorepo because multiple packages can share or diverge in version numbers.

## Historical cleanup

Earlier local bare tags `0.1.0` and `0.2.0` referred to Jira board extension releases. They were deleted during release-policy cleanup because they looked like repository-wide versions.

If those releases need to be tagged again, recreate them with package-scoped names only, for example:

```bash
git tag pi-extension-jira-board/v0.1.0 <old-jira-0.1.0-commit>
git tag pi-extension-jira-board/v0.2.0 <old-jira-0.2.0-commit>
```

## Release checklist

For a package release:

1. Update only that package's `package.json` version.
2. Update that package's `CHANGELOG.md` with a dated release section.
3. Update package-specific docs under `docs/<package-name>/` as needed.
4. Run `npm run verify:release`. It verifies the five release-ready packages' tests, typechecks, pack dry-runs, root typecheck/tool/style checks, lockfile consistency, all-five offline/no-session load plus `/web-search-doctor` smoke, and `git diff --check`. The GitHub `Verify` workflow runs the same command on pushes and pull requests.
5. Avoid committing unrelated `package-lock.json` changes.
6. Commit the intended release changes only after every gate passes.
7. If tagging, create an annotated package-scoped tag from that release commit: `git tag -a pi-extension-<name>/vX.Y.Z -m "pi-extension-<name> vX.Y.Z"`.
8. Push a tag or publish to npm only with explicit intent for that specific release.

`verify:release` never publishes, pushes, or creates tags.
