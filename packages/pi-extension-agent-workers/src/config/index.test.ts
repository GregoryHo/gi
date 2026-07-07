import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  getWorkspaceConfigPath,
  readWorkspaceConfig,
  updateWorkspaceConfig,
  validateWorkspaceConfigPatch,
} from "./index.ts";

test("readWorkspaceConfig returns safe defaults when no config exists", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-workers-config-"));

  const config = await readWorkspaceConfig({ configDir: dir, scopeKey: "/tmp/project", scopeLabel: "project" });

  assert.deepEqual(config, {
    version: 1,
    scopeKey: "/tmp/project",
    scopeLabel: "project",
  });
});

test("updateWorkspaceConfig writes one local config file per workspace scope", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-workers-config-"));

  const config = await updateWorkspaceConfig(
    { configDir: dir, scopeKey: "/tmp/project", scopeLabel: "project" },
    { defaultProfile: "verifier", defaultTimeoutMs: 60_000, widgetPlacement: "belowEditor" },
  );

  assert.equal(config.defaultProfile, "verifier");
  assert.equal(config.defaultTimeoutMs, 60_000);
  assert.equal(config.widgetPlacement, "belowEditor");

  const raw = await readFile(getWorkspaceConfigPath(dir, "/tmp/project"), "utf8");
  assert.match(raw, /"scopeKey": "\/tmp\/project"/);
  assert.doesNotMatch(raw, /secret|token|password/i);
});

test("readWorkspaceConfig preserves validated custom profiles", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-workers-config-"));

  const config = await updateWorkspaceConfig(
    { configDir: dir, scopeKey: "/tmp/project", scopeLabel: "project" },
    {
      profiles: [
        {
          name: "docs-checker",
          description: "Check docs only.",
          adapter: "demo",
          mode: "review",
          systemPrompt: "Review docs for consistency.",
          requireConfirmation: false,
          readOnly: true,
          canModifyWorkspace: false,
          recommendedUse: "Use for local demo docs review.",
        },
      ],
    },
  );

  assert.equal(config.profiles?.[0]?.name, "docs-checker");
});

test("readWorkspaceConfig rejects unsafe custom profiles", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-workers-config-"));

  await assert.rejects(
    () => updateWorkspaceConfig(
      { configDir: dir, scopeKey: "/tmp/project", scopeLabel: "project" },
      {
        profiles: [
          {
            name: "unsafe",
            description: "Unsafe real worker.",
            adapter: "claude-code",
            mode: "review",
            requireConfirmation: false,
            readOnly: true,
            canModifyWorkspace: false,
            recommendedUse: "Should be rejected.",
          },
        ],
      },
    ),
    /must require confirmation/,
  );
});

test("readWorkspaceConfig rejects malformed local config", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-workers-config-"));
  await updateWorkspaceConfig({ configDir: dir, scopeKey: "/tmp/project", scopeLabel: "project" }, { defaultAdapter: "demo" });

  await assert.rejects(
    () => updateWorkspaceConfig({ configDir: dir, scopeKey: "/tmp/project", scopeLabel: "project" }, { defaultTimeoutMs: -1 }),
    /defaultTimeoutMs must be between/,
  );
});

test("validateWorkspaceConfigPatch accepts only safe known values", () => {
  assert.deepEqual(validateWorkspaceConfigPatch("defaultAdapter", "demo"), { defaultAdapter: "demo" });
  assert.deepEqual(validateWorkspaceConfigPatch("defaultAdapter", "pi-sdk"), { defaultAdapter: "pi-sdk" });
  assert.deepEqual(validateWorkspaceConfigPatch("defaultProfile", "reviewer"), { defaultProfile: "reviewer" });
  assert.deepEqual(validateWorkspaceConfigPatch("defaultTimeoutMs", "1000"), { defaultTimeoutMs: 1000 });
  assert.deepEqual(validateWorkspaceConfigPatch("historyScope", "all"), { historyScope: "all" });
  assert.deepEqual(validateWorkspaceConfigPatch("widgetPlacement", "belowEditor"), { widgetPlacement: "belowEditor" });
  assert.deepEqual(validateWorkspaceConfigPatch("widgetLimit", "4"), { widgetLimit: 4 });

  assert.throws(() => validateWorkspaceConfigPatch("requireConfirmation", "false"), /Unknown worker config key/);
  assert.throws(() => validateWorkspaceConfigPatch("defaultAdapter", "claude"), /defaultAdapter must be/);
});
