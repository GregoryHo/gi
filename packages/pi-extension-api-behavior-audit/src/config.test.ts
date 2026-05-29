import assert from "node:assert/strict";
import test from "node:test";

import { ApiAuditConfigError, isLocalHttpUrl, parseAccountActivityCaptureArgs } from "./config.ts";

test("isLocalHttpUrl accepts localhost and loopback URLs", () => {
  assert.equal(isLocalHttpUrl("http://localhost:8080"), true);
  assert.equal(isLocalHttpUrl("http://127.0.0.1:8008"), true);
  assert.equal(isLocalHttpUrl("http://[::1]:8008"), true);
});

test("isLocalHttpUrl rejects remote or non-http URLs", () => {
  assert.equal(isLocalHttpUrl("https://prod.example.com"), false);
  assert.equal(isLocalHttpUrl("file:///tmp/app"), false);
  assert.equal(isLocalHttpUrl("not-a-url"), false);
});

test("parseAccountActivityCaptureArgs parses explicit local base URLs and artifact dir", () => {
  const config = parseAccountActivityCaptureArgs(
    "account-activity --old-url http://localhost:8080 --new-url http://localhost:8008 --artifact-dir ./runs --manifest ./api-audit.scenarios.json",
    {},
  );

  assert.deepEqual(config, {
    command: "account-activity",
    oldBaseUrl: "http://localhost:8080",
    newBaseUrl: "http://localhost:8008",
    artifactDir: "./runs",
    manifestPath: "./api-audit.scenarios.json",
  });
});

test("parseAccountActivityCaptureArgs uses local environment defaults", () => {
  const config = parseAccountActivityCaptureArgs("account-activity", {
    API_AUDIT_OLD_BASE_URL: "http://localhost:8080",
    API_AUDIT_NEW_BASE_URL: "http://127.0.0.1:8008",
    API_AUDIT_ARTIFACT_DIR: ".custom-runs",
  });

  assert.equal(config.oldBaseUrl, "http://localhost:8080");
  assert.equal(config.newBaseUrl, "http://127.0.0.1:8008");
  assert.equal(config.artifactDir, ".custom-runs");
});

test("parseAccountActivityCaptureArgs rejects unknown subcommands and remote base URLs", () => {
  assert.throws(() => parseAccountActivityCaptureArgs("unknown", {}), ApiAuditConfigError);
  assert.throws(
    () =>
      parseAccountActivityCaptureArgs(
        "account-activity --old-url https://prod.example.com --new-url http://localhost:8008",
        {},
      ),
    /Only local old\/new base URLs are allowed/,
  );
});
