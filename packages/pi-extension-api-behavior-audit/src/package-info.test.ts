import assert from "node:assert/strict";
import test from "node:test";

import {
  API_DISCOVERY_ANALYZE_COMMAND,
  API_DISCOVERY_CREATE_COMMAND,
  API_DISCOVERY_FINISH_COMMAND,
  API_DISCOVERY_OPEN_COMMAND,
  API_DISCOVERY_RECORD_COMMAND,
  API_DISCOVERY_SCENARIO_COMMAND,
  API_DISCOVERY_STATUS_COMMAND,
  API_DISCOVERY_SUGGEST_COMMAND,
  API_DISCOVERY_STOP_COMMAND,
  API_DISCOVERY_VALIDATE_SUGGESTION_COMMAND,
  PACKAGE_COMMAND,
  PACKAGE_KEY,
  PACKAGE_NAME,
} from "./package-info.ts";

test("exports stable package identifiers for commands and widgets", () => {
  assert.equal(PACKAGE_KEY, "api-behavior-audit");
  assert.equal(PACKAGE_NAME, "api-behavior-audit");
  assert.equal(PACKAGE_COMMAND, "api-audit");
  assert.equal(API_DISCOVERY_CREATE_COMMAND, "api-discovery-create");
  assert.equal(API_DISCOVERY_STATUS_COMMAND, "api-discovery-status");
  assert.equal(API_DISCOVERY_SCENARIO_COMMAND, "api-discovery-scenario");
  assert.equal(API_DISCOVERY_OPEN_COMMAND, "api-discovery-open");
  assert.equal(API_DISCOVERY_RECORD_COMMAND, "api-discovery-record");
  assert.equal(API_DISCOVERY_FINISH_COMMAND, "api-discovery-finish");
  assert.equal(API_DISCOVERY_STOP_COMMAND, "api-discovery-stop");
  assert.equal(API_DISCOVERY_ANALYZE_COMMAND, "api-discovery-analyze");
  assert.equal(API_DISCOVERY_SUGGEST_COMMAND, "api-discovery-suggest");
  assert.equal(API_DISCOVERY_VALIDATE_SUGGESTION_COMMAND, "api-discovery-validate-suggestion");
});
