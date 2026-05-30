import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { JiraConfigError, loadJiraConfig, summarizeJiraConfig } from "./index.ts";
import { saveLocalJiraCredentials } from "./local.ts";

test("loadJiraConfig reports all missing required environment variables", () => {
  assert.throws(
    () => loadJiraConfig({}, { configDir: join(tmpdir(), "missing-jira-config-required-env-test") }),
    (error) => {
      assert.ok(error instanceof JiraConfigError);
      assert.match(error.message, /JIRA_BASE_URL/);
      assert.match(error.message, /JIRA_USER or JIRA_EMAIL/);
      assert.match(error.message, /JIRA_TOKEN or JIRA_PASSWORD/);
      return true;
    },
  );
});

test("loadJiraConfig normalizes base URL and parses optional project and board", () => {
  const config = loadJiraConfig({
    JIRA_BASE_URL: "https://jira.example.com/",
    JIRA_USER: "jira-user",
    JIRA_TOKEN: "secret-token",
    JIRA_PROJECT: "PROJ",
    JIRA_BOARD_ID: "123",
  });

  assert.equal(config.baseUrl, "https://jira.example.com");
  assert.equal(config.user, "jira-user");
  assert.equal(config.secret, "secret-token");
  assert.equal(config.project, "PROJ");
  assert.equal(config.boardId, 123);
});

test("loadJiraConfig rejects invalid board IDs", () => {
  assert.throws(
    () =>
      loadJiraConfig({
        JIRA_BASE_URL: "https://jira.example.com",
        JIRA_EMAIL: "jira@example.com",
        JIRA_PASSWORD: "password",
        JIRA_BOARD_ID: "not-a-number",
      }),
    /Invalid JIRA_BOARD_ID/,
  );
});

test("loadJiraConfig reads encrypted local config when required env vars are absent", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jira-config-"));
  await saveLocalJiraCredentials(
    {
      baseUrl: "https://local-jira.example.com/",
      user: "local-user",
      authType: "token",
      secret: "local-secret",
      project: "LOCAL",
      boardId: 456,
    },
    { configDir: dir },
  );

  const config = loadJiraConfig({}, { configDir: dir });

  assert.deepEqual(config, {
    baseUrl: "https://local-jira.example.com",
    user: "local-user",
    secret: "local-secret",
    project: "LOCAL",
    boardId: 456,
  });
});

test("loadJiraConfig keeps complete env credentials higher priority than local config", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jira-config-"));
  await saveLocalJiraCredentials(
    {
      baseUrl: "https://local-jira.example.com",
      user: "local-user",
      authType: "token",
      secret: "local-secret",
    },
    { configDir: dir },
  );

  const config = loadJiraConfig(
    {
      JIRA_BASE_URL: "https://env-jira.example.com/",
      JIRA_USER: "env-user",
      JIRA_TOKEN: "env-secret",
      JIRA_PROJECT: "ENV",
    },
    { configDir: dir },
  );

  assert.equal(config.baseUrl, "https://env-jira.example.com");
  assert.equal(config.user, "env-user");
  assert.equal(config.secret, "env-secret");
  assert.equal(config.project, "ENV");
});

test("loadJiraConfig reports onboarding hint when no env or local config exists", () => {
  assert.throws(
    () => loadJiraConfig({}, { configDir: join(tmpdir(), "missing-jira-config-for-test") }),
    /Run \/jira-onboarding/,
  );
});

test("summarizeJiraConfig omits credential values", () => {
  const summary = summarizeJiraConfig(
    loadJiraConfig({
      JIRA_BASE_URL: "https://jira.example.com/",
      JIRA_USER: "jira-user",
      JIRA_TOKEN: "secret-token",
      JIRA_PROJECT: "PROJ",
      JIRA_BOARD_ID: "123",
    }),
  );

  assert.deepEqual(summary, {
    baseUrl: "https://jira.example.com",
    project: "PROJ",
    boardId: "123",
    userConfigured: true,
    secretConfigured: true,
  });
  assert.equal(JSON.stringify(summary).includes("jira-user"), false);
  assert.equal(JSON.stringify(summary).includes("secret-token"), false);
});
