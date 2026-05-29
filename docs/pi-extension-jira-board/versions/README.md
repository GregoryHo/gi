# Versioned planning docs

Future Jira board extension versions should use this directory.

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

- Use SemVer for version folders, for example `0.2.0`.
- Use dates for individual design or implementation-plan files.
- Keep the active version linked from `../index.md`.
- Append milestone start/completion entries to the version `log.md`.
- When the version ships, update `../archive.md` and package `CHANGELOG.md`.
