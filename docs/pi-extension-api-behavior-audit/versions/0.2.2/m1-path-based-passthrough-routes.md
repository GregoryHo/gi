# v0.2.2 M1 — Path-based passthrough routes

## Status

Done.

## SPEC

Support local legacy services that need selected non-API paths routed to their real frontend/static service while API paths continue to flow through the recording proxy.

Problem observed:

```text
/includes/js/transfer-popup/index.js 404
/includes/js/order-detail-component/index.js 404
Refused to execute script because MIME type is text/plain
```

Root cause:

The Node recording proxy forwarded every request path to `upstreamTargetUrl`. Frontend/static asset paths were sent to the API upstream and returned API-style `404 text/plain` responses.

Solution:

Add target-profile v2 `passthroughRoutes`:

```json
{
  "pathPrefix": "/includes/js/",
  "targetBaseUrl": "http://localhost:8080"
}
```

Requests with matching path prefixes are forwarded to the passthrough target and are not recorded as upstream API exchanges. Non-matching requests keep the existing behavior and are forwarded to the target's `upstreamTargetUrl`.

## AC

- `/includes/js/...` can be forwarded to a frontend/static service and preserve JavaScript content type.
- Passthrough requests do not increment exchange count and are not written to `exchanges.ndjson`.
- API requests still go to `upstreamTargetUrl` and are recorded.
- Route targets must be local or explicitly allowlisted.
- Preparation output shows configured passthrough routes.

## Verification

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit -- src/adapters/recording-proxy.test.ts src/adapters/target-capture.test.ts
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
```
