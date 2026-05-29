# Versioned planning docs

Future API behavior audit extension versions should use this directory.

Recommended structure:

```text
versions/<semver>/
├── index.md
├── milestones.md
├── log.md
├── m<N>-<topic>.md
└── decisions.md              # optional
```

Rules:

- Use SemVer for version folders, for example `0.1.1`.
- Keep the active version linked from `../index.md`.
- Milestone numbers restart inside each version folder; use full references like `v0.1.1 M1` in logs.
- Append milestone start/completion entries to the version `log.md`.
- Keep raw API payloads, credentials, private hostnames, and local-only secrets out of committed docs.
- When a version ships, update `../archive.md`, `../index.md`, `../log.md`, package `CHANGELOG.md`, and package `package.json` version as appropriate.
