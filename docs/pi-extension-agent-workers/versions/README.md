# Versioned planning docs

Future agent workers extension versions should use this directory.

Recommended structure:

```text
versions/<semver>/
├── index.md
├── milestones.md
├── log.md
├── decisions.md              # optional
└── YYYY-MM-DD-<topic>.md     # design/spec/implementation plans
```

Rules:

- Use SemVer for version folders, for example `0.3.0`.
- Keep the active version linked from `../index.md`.
- Append milestone start/completion entries to the version `log.md`.
- Keep raw worker logs, prompts, and private context out of committed docs.
- When the version ships, update `../archive.md`, `../index.md`, `../log.md`, and package `CHANGELOG.md`.
