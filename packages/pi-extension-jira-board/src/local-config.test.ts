import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  getLocalJiraPaths,
  readLocalJiraConfig,
  saveLocalJiraCredentials,
} from "./local-config.ts";

test("saveLocalJiraCredentials separates non-secret config from encrypted secret", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jira-local-config-"));

  await saveLocalJiraCredentials(
    {
      baseUrl: "https://jira.example.com/",
      user: "jira-user",
      authType: "token",
      secret: "secret-token",
      project: "PROJ",
      boardId: 123,
    },
    { configDir: dir },
  );

  const paths = getLocalJiraPaths(dir);
  const configRaw = await readFile(paths.configPath, "utf8");
  const secretsRaw = await readFile(paths.secretsPath, "utf8");

  assert.equal(configRaw.includes("secret-token"), false);
  assert.equal(secretsRaw.includes("secret-token"), false);

  const config = await readLocalJiraConfig({ configDir: dir });
  assert.deepEqual(config, {
    baseUrl: "https://jira.example.com",
    user: "jira-user",
    secret: "secret-token",
    project: "PROJ",
    boardId: 123,
  });
});

test("readLocalJiraConfig reports missing local config with onboarding hint", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jira-local-config-"));

  await assert.rejects(() => readLocalJiraConfig({ configDir: dir }), /Run \/jira-onboarding/);
});

test("readLocalJiraConfig reports missing encrypted secret without leaking values", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jira-local-config-"));

  await saveLocalJiraCredentials(
    {
      baseUrl: "https://jira.example.com",
      user: "jira-user",
      authType: "password",
      secret: "secret-password",
    },
    { configDir: dir },
  );

  const paths = getLocalJiraPaths(dir);
  await writeFile(paths.secretsPath, "{}\n", "utf8");

  await assert.rejects(
    () => readLocalJiraConfig({ configDir: dir }),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /Missing encrypted Jira secret/);
      assert.equal(error.message.includes("secret-password"), false);
      return true;
    },
  );
});

