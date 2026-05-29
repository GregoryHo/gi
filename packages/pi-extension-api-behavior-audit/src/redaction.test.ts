import assert from "node:assert/strict";
import test from "node:test";

import { REDACTED, redactHeaders, redactJsonLike, redactUrl, sanitizeExchange } from "./redaction.ts";
import type { ApiExchange } from "./types.ts";

test("redactHeaders redacts sensitive header names case-insensitively", () => {
  const headers = redactHeaders({
    Authorization: "Bearer value-to-hide",
    Cookie: "sid=value-to-hide",
    "x-ps-device-token": "value-to-hide",
    "content-type": "application/json",
  });

  assert.deepEqual(headers, {
    Authorization: REDACTED,
    Cookie: REDACTED,
    "x-ps-device-token": REDACTED,
    "content-type": "application/json",
  });
});

test("redactJsonLike preserves structure while redacting sensitive keys", () => {
  const redacted = redactJsonLike({
    account: "demo-user",
    accessToken: "value-to-hide-1",
    nested: {
      password: "value-to-hide-2",
      safe: true,
    },
    callbackUrl: "/next?token=value-to-hide-4&page=1",
    echoedBody: JSON.stringify({ password: "value-to-hide-5", safe: "ok" }),
    items: [{ csrf: "value-to-hide-3" }, "plain-value"],
  });

  assert.deepEqual(redacted, {
    account: "demo-user",
    accessToken: REDACTED,
    nested: {
      password: REDACTED,
      safe: true,
    },
    callbackUrl: "/next?token=%5BREDACTED%5D&page=1",
    echoedBody: { password: REDACTED, safe: "ok" },
    items: [{ csrf: REDACTED }, "plain-value"],
  });
});

test("redactUrl redacts sensitive query parameters and preserves non-sensitive parameters", () => {
  const redacted = redactUrl("http://localhost:8080/apis/account/activity?token=value-to-hide&page=1&sessionId=value-to-hide-2");

  assert.equal(redacted, "http://localhost:8080/apis/account/activity?token=%5BREDACTED%5D&page=1&sessionId=%5BREDACTED%5D");
});

test("sanitizeExchange redacts request and response sensitive fields", () => {
  const exchange: ApiExchange = {
    runId: "run-1",
    layer: "upstream",
    side: "old",
    scenarioId: "account-activity-basic",
    request: {
      method: "GET",
      url: "http://localhost:18080/v1/account/activity?token=value-to-hide",
      headers: { authorization: "Bearer value-to-hide" },
      body: { safe: "ok", password: "value-to-hide" },
    },
    response: {
      status: 200,
      headers: { "set-cookie": "sid=value-to-hide" },
      body: { items: [], nextToken: "value-to-hide" },
    },
    timing: { startedAt: "2026-05-24T00:00:00.000Z", durationMs: 12 },
    provenance: { source: "recording-proxy" },
  };

  const sanitized = sanitizeExchange(exchange);
  const serialized = JSON.stringify(sanitized);

  assert.equal(serialized.includes("value-to-hide"), false);
  assert.equal(sanitized.request.headers.authorization, REDACTED);
  assert.equal((sanitized.request.body as { password: string }).password, REDACTED);
  assert.equal(sanitized.response.headers["set-cookie"], REDACTED);
  assert.equal((sanitized.response.body as { nextToken: string }).nextToken, REDACTED);
});
