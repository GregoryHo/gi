# Release and tag policy

This repository is a private monorepo for multiple independent pi packages.

## Version ownership

- The root package `gregho-pi-extensions` is a private workspace container and does not represent a product release version.
- Each package under `packages/<package-name>/` owns its own `package.json` version.
- Package versions may move independently. Do not infer repository release state from one package's version.

Current package versions:

| Package | Current version | Notes |
| --- | ---: | --- |
| `@gregho/pi-extension-jira-board` | `0.2.0` | Jira board/context extension |
| `@gregho/pi-extension-agent-workers` | `0.3.1` | Patch release removing temporary worker UI PoC command |
| `@gregho/pi-extension-api-behavior-audit` | `0.2.0` | Programmatic capture lifecycle and bounded automation local release |

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
4. Run the package verification commands and root typecheck.
5. Avoid committing unrelated `package-lock.json` changes.
6. If tagging, use `pi-extension-<name>/vX.Y.Z`.

Publishing to npm or pushing tags is optional and requires explicit intent for that release.
