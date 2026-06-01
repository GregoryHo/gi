# API behavior audit v0.2.1 planning index

## Status

- Version: `0.2.1`
- Package: `packages/pi-extension-api-behavior-audit`
- Status: In progress
- Branch: `feature/api-behavior-audit-0.2.1-persistent-proxy-windows`

## Theme

Persistent proxy sessions with clean recording windows.

v0.2.1 separates recorder proxy process lifecycle from recording artifact lifecycle so legacy apps can keep using stable local proxy URLs while agents start/stop clean capture windows.

## Target lifecycle

```text
start proxy session
  -> old/new proxy sockets stay listening, paused passthrough
start recording window
  -> create fresh run dirs and record selected action
stop recording window
  -> finalize manifests/exchange counts, keep proxy sockets alive
stop proxy session
  -> close local proxy sockets when no more windows are needed
```

## Milestones

See `milestones.md`.
