import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import test from "node:test";

import { createWorkspacePathContext, resolveWorkspacePath } from "./workspace-paths.ts";

test("createWorkspacePathContext prefers discovered git root over cwd", async () => {
  const root = await mkdtemp(join(tmpdir(), "api-audit-workspace-root-"));
  const cwd = join(root, "packages", "target-app");

  const context = await createWorkspacePathContext(cwd, {
    discoverGitRoot: async () => root,
  });

  assert.equal(context.cwd, cwd);
  assert.equal(context.workspaceRoot, root);
  assert.equal(context.gitRoot, root);
  assert.equal(resolveWorkspacePath(context, ".pi-api-audit-runs"), join(root, ".pi-api-audit-runs"));
});

test("createWorkspacePathContext falls back to cwd and preserves absolute paths", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "api-audit-workspace-cwd-"));
  const absolute = join(cwd, "custom-runs");

  const context = await createWorkspacePathContext(cwd, {
    discoverGitRoot: async () => undefined,
  });

  assert.equal(context.workspaceRoot, cwd);
  assert.equal(context.gitRoot, undefined);
  assert.equal(resolveWorkspacePath(context, "custom-runs"), join(cwd, "custom-runs"));
  assert.equal(resolveWorkspacePath(context, absolute), absolute);
  assert.equal(isAbsolute(resolveWorkspacePath(context, ".pi-api-audit-runs")), true);
});
