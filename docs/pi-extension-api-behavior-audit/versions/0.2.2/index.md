# API behavior audit v0.2.2 planning index

## Status

- Version: `0.2.2`
- Package: `packages/pi-extension-api-behavior-audit`
- Status: Released / sealed local package release
- Branch: `feature/api-behavior-audit-0.2.2-path-routing`

## Theme

Path-based passthrough routing patch for local legacy proxy compatibility.

v0.2.2 fixes the case where a legacy local service is routed through the Node recording proxy and non-API frontend/static asset paths such as `/includes/js/...` are mistakenly forwarded to the API upstream, returning `404 text/plain` and causing browser MIME-type script failures.

## Milestones

See `milestones.md`.
