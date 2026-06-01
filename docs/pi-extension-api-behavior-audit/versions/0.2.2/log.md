# API behavior audit v0.2.2 log

- Started v0.2.2 patch branch `feature/api-behavior-audit-0.2.2-path-routing` from sealed v0.2.1 `main` after diagnosing that legacy local frontend/static asset requests such as `/includes/js/transfer-popup/index.js` were being forwarded to the API upstream recorder and returning `404 text/plain`.
- Implemented path-based passthrough routing in the Node recording proxy. Matching `passthroughRoutes` are forwarded to the configured frontend/static target and are not recorded as upstream API exchanges.
- Added target profile v2 passthrough route resolution and preparation guidance.
- Completed local release prep for v0.2.2. Package version/lockfile/changelog updated to `0.2.2`, root/version docs archived and sealed, release policy updated, and verification passed. No publish or tag was created.
