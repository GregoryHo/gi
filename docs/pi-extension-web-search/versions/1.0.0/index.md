# Web Search 1.0.0 planning

## Status

Planned.

## Goal

Prepare `pi-extension-web-search` for public GitHub use before 1.0.0, where another user can clone the repository, install the local package path, verify setup, and use the extension without private context from the author.

1.0.0 should declare the existing small/read-only web research capability stable. It should not become a broad `pi-web-access` replacement.

## Public GitHub target

The intended public install flow is clone-and-install from the monorepo package path:

```bash
git clone <public-repo-url>
cd <repo>
npm install
pi install ./packages/pi-extension-web-search
```

Temporary trial flow:

```bash
pi -e ./packages/pi-extension-web-search
```

Direct `pi install git:github.com/<owner>/<repo>` is not a 1.0.0 requirement because this repository is a monorepo and the root package is not the standalone Web Search pi package.

## Product positioning

Web Search is intentionally:

- Small.
- Read-only.
- OpenAI/Codex-backed for search.
- SSRF-guarded for public URL fetching.
- Session-local for search/fetched-content provenance.
- Free of browser-cookie access, JavaScript rendering, persistent content storage, and broad media/GitHub/PDF special handling.

## Milestones

- M1 — `m1-github-clone-usability.md`: make clone-and-install usage self-documenting.
- M2 — `m2-public-metadata-license.md`: add public repository metadata, license, and release-policy cleanup.
- M3 — `m3-web-search-doctor.md`: add a diagnostics command for auth/setup troubleshooting.
- M4 — `m4-public-release-candidate.md`: run public clone smoke and release hardening before 1.0.0.
- M5 — `m5-1.0.0-sealing.md`: bump to 1.0.0, seal docs, and optionally tag with a package-scoped tag.

## Non-goals before 1.0.0

- Multi-provider routing or fallback.
- Browser-cookie access.
- Gemini Web access.
- Curator/browser UI.
- YouTube or local video handling.
- PDF special handling.
- GitHub repository cloning or full repository browsing.
- Jina Reader or blocked-page fallback services.
- npm publication.
- Direct monorepo root `pi install git:...` support.

## Release shape

A good 1.0.0 release is one where:

- A stranger can clone the repo and install the package path.
- README docs explain capabilities, limits, auth, troubleshooting, and verification.
- Public metadata and license are present.
- The diagnostics command helps users distinguish extension load issues from auth/provider issues.
- Existing test/typecheck/pack verification passes.
- A manual authenticated smoke test has been recorded.
