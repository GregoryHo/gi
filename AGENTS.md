# Repository guidance

This repo is for developing personal pi extensions and pi packages.

## Structure

- `packages/<package-name>/` contains standalone pi packages that can be loaded with `pi -e` or installed with `pi install`.
- Package-level `package.json` files should declare a `pi` manifest when they expose extensions, skills, prompts, or themes.
- Package versions are independent; follow `docs/release-policy.md` and use package-scoped tags like `pi-extension-agent-workers/v0.1.0`.
- Planning docs for larger package work live under `docs/<package-name>/`, matching the package directory name exactly.
- Each package with non-trivial roadmap or milestones should have paired governance files:
  - `docs/<package-name>/AGENTS.md` for product/spec documentation rules.
  - `packages/<package-name>/AGENTS.md` for implementation workflow and package-specific safety rules.

## Development rules

- Prefer small, follow-up-friendly milestones over large rewrites.
- Keep extensions safe by default: read-only integrations first; write actions require explicit user confirmation.
- Do not commit secrets. Credentials should be read from environment variables or local config/artifact files that are ignored by git.
- Do not create bare repo-global semver tags (`0.1.0`, `v0.1.0`) for package releases.
- For pi extension APIs, follow the installed pi docs in `docs/extensions.md`, `docs/packages.md`, and `docs/tui.md` from the local pi installation.

