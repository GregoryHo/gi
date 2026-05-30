import assert from "node:assert/strict";
import test from "node:test";

import { ProxyConfigError, isAllowedProxyTarget, parseRecordingProxyArgs } from "./proxy-config.ts";

test("parseRecordingProxyArgs parses required proxy flags and defaults", () => {
  const config = parseRecordingProxyArgs(
    "proxy --side old --listen-port 18080 --target-url http://localhost:19080 --artifact-dir ./runs",
  );

  assert.deepEqual(config, {
    command: "proxy",
    side: "old",
    listenHost: "127.0.0.1",
    listenPort: 18080,
    targetBaseUrl: "http://localhost:19080",
    artifactDir: "./runs",
    scenarioId: "recording-proxy-spike",
    allowedHosts: [],
  });
});

test("parseRecordingProxyArgs rejects invalid listen ports and sides", () => {
  assert.throws(
    () => parseRecordingProxyArgs("proxy --side old --listen-port 0 --target-url http://localhost:19080"),
    ProxyConfigError,
  );
  assert.throws(
    () => parseRecordingProxyArgs("proxy --side both --listen-port 18080 --target-url http://localhost:19080"),
    ProxyConfigError,
  );
});

test("parseRecordingProxyArgs rejects remote targets unless allow-host matches", () => {
  assert.equal(isAllowedProxyTarget("https://api.example.test", []), false);
  assert.equal(isAllowedProxyTarget("https://api.example.test", ["api.example.test"]), true);

  assert.throws(
    () => parseRecordingProxyArgs("proxy --side old --listen-port 18080 --target-url https://api.example.test"),
    /Target URL must be local or explicitly allowed/,
  );

  const config = parseRecordingProxyArgs(
    "proxy --side old --listen-port 18080 --target-url https://api.example.test --allow-host api.example.test",
  );

  assert.equal(config.targetBaseUrl, "https://api.example.test");
  assert.deepEqual(config.allowedHosts, ["api.example.test"]);
});
