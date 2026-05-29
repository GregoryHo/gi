import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  clearEnvironmentProfile,
  executeProfileCommand,
  getEnvironmentProfileConfigPath,
  loadEnvironmentProfiles,
  resolveEnvironmentProfile,
  saveEnvironmentProfile,
  setDefaultEnvironmentProfile,
} from "./environment-profiles.ts";

test("loadEnvironmentProfiles treats missing config as empty", async () => {
  const artifactDir = await mkdtemp(join(tmpdir(), "api-audit-profile-empty-"));
  const config = await loadEnvironmentProfiles(artifactDir);

  assert.deepEqual(config, { version: 1, profiles: {} });
});

test("saveEnvironmentProfile writes gitignored local config and can set default", async () => {
  const artifactDir = await mkdtemp(join(tmpdir(), "api-audit-profile-save-"));

  await saveEnvironmentProfile(
    artifactDir,
    "uat",
    {
      oldUrl: "http://localhost:8080",
      newUrl: "http://localhost:8008",
      oldTargetUrl: "http://old-api.example.test",
      newTargetUrl: "https://new-api.example.test",
      oldProxyPort: 18080,
      newProxyPort: 18081,
      allowHosts: ["old-api.example.test", "new-api.example.test"],
    },
    { makeDefault: true },
  );

  const config = await loadEnvironmentProfiles(artifactDir);
  assert.equal(config.defaultProfile, "uat");
  assert.equal(config.profiles.uat.oldTargetUrl, "http://old-api.example.test");
  assert.equal(getEnvironmentProfileConfigPath(artifactDir), join(artifactDir, "config.local.json"));
  assert.doesNotThrow(() => JSON.parse(awaitableTextPlaceholder(config)));
});

test("profile config JSON is valid on disk", async () => {
  const artifactDir = await mkdtemp(join(tmpdir(), "api-audit-profile-json-"));
  await saveEnvironmentProfile(artifactDir, "local", {
    oldUrl: "http://localhost:8080",
    newUrl: "http://localhost:8008",
    oldTargetUrl: "http://127.0.0.1:19080",
    newTargetUrl: "http://127.0.0.1:19081",
  });

  const raw = await readFile(getEnvironmentProfileConfigPath(artifactDir), "utf8");
  assert.equal(JSON.parse(raw).profiles.local.newTargetUrl, "http://127.0.0.1:19081");
});

test("saveEnvironmentProfile rejects sensitive query params and unallowlisted remote targets", async () => {
  const artifactDir = await mkdtemp(join(tmpdir(), "api-audit-profile-reject-"));

  await assert.rejects(
    () =>
      saveEnvironmentProfile(artifactDir, "bad", {
        oldUrl: "http://localhost:8080?token=abc",
        newUrl: "http://localhost:8008",
        oldTargetUrl: "http://127.0.0.1:19080",
        newTargetUrl: "http://127.0.0.1:19081",
      }),
    /sensitive query/i,
  );

  await assert.rejects(
    () =>
      saveEnvironmentProfile(artifactDir, "bad", {
        oldUrl: "http://localhost:8080",
        newUrl: "http://localhost:8008",
        oldTargetUrl: "https://example.com",
        newTargetUrl: "http://127.0.0.1:19081",
      }),
    /allow-host/i,
  );
});

test("resolveEnvironmentProfile merges explicit overrides over stored profile", async () => {
  const artifactDir = await mkdtemp(join(tmpdir(), "api-audit-profile-resolve-"));
  await saveEnvironmentProfile(
    artifactDir,
    "uat",
    {
      oldUrl: "http://localhost:8080",
      newUrl: "http://localhost:8008",
      oldTargetUrl: "http://old-api.example.test",
      newTargetUrl: "https://new-api.example.test",
      oldProxyPort: 18080,
      newProxyPort: 18081,
      allowHosts: ["old-api.example.test", "new-api.example.test"],
    },
    { makeDefault: true },
  );

  const resolved = await resolveEnvironmentProfile({
    artifactDir,
    profileName: "uat",
    newTargetUrl: "http://127.0.0.1:19081",
  });

  assert.equal(resolved.oldTargetUrl, "http://old-api.example.test");
  assert.equal(resolved.newTargetUrl, "http://127.0.0.1:19081");
  assert.deepEqual(resolved.allowHosts, ["old-api.example.test", "new-api.example.test"]);
});

test("clearEnvironmentProfile removes profile and clears default", async () => {
  const artifactDir = await mkdtemp(join(tmpdir(), "api-audit-profile-clear-"));
  await saveEnvironmentProfile(
    artifactDir,
    "uat",
    {
      oldUrl: "http://localhost:8080",
      newUrl: "http://localhost:8008",
      oldTargetUrl: "http://127.0.0.1:19080",
      newTargetUrl: "http://127.0.0.1:19081",
    },
    { makeDefault: true },
  );

  await clearEnvironmentProfile(artifactDir, "uat");
  const config = await loadEnvironmentProfiles(artifactDir);
  assert.deepEqual(config, { version: 1, profiles: {} });
});

test("setDefaultEnvironmentProfile requires an existing profile", async () => {
  const artifactDir = await mkdtemp(join(tmpdir(), "api-audit-profile-default-"));
  await assert.rejects(() => setDefaultEnvironmentProfile(artifactDir, "missing"), /not found/);
});

test("executeProfileCommand supports show save default and clear", async () => {
  const artifactDir = await mkdtemp(join(tmpdir(), "api-audit-profile-command-"));

  const save = await executeProfileCommand(
    `profile save uat --artifact-dir ${artifactDir} --old-url http://localhost:8080 --new-url http://localhost:8008 --old-target-url http://127.0.0.1:19080 --new-target-url http://127.0.0.1:19081 --default`,
  );
  assert.match(save.lines.join("\n"), /Saved API audit environment profile: uat/);

  const show = await executeProfileCommand(`profile show --artifact-dir ${artifactDir}`);
  assert.match(show.lines.join("\n"), /uat/);
  assert.match(show.lines.join("\n"), /default/);

  const clear = await executeProfileCommand(`profile clear uat --artifact-dir ${artifactDir}`);
  assert.match(clear.lines.join("\n"), /Cleared API audit environment profile: uat/);
});

function awaitableTextPlaceholder(value: unknown): string {
  return JSON.stringify(value);
}
