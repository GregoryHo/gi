import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  discoverWorkspaceCandidates,
  formatWorkspaceStatusLines,
  resolveWorkerCwd,
  resolveWorkspaceScope,
  validateWorkerWorkspace,
} from "./workspaces.ts";

test("resolveWorkerCwd resolves explicit cwd before current cwd without sticky state", () => {
  assert.equal(resolveWorkerCwd(undefined, "/tmp/current"), "/tmp/current");
  assert.equal(resolveWorkerCwd("/tmp/explicit", "/tmp/current"), "/tmp/explicit");
});

test("resolveWorkspaceScope uses git root when available and cwd otherwise", async () => {
  const root = await makeTempDir("workspace-scope");
  const repo = join(root, "repo");
  const nested = join(repo, "packages", "app");
  const nonGit = join(root, "scratch");
  await mkdir(join(repo, ".git"), { recursive: true });
  await mkdir(nested, { recursive: true });
  await mkdir(nonGit, { recursive: true });

  assert.deepEqual(resolveWorkspaceScope(nested), {
    scopeKey: repo,
    scopeLabel: "repo",
    gitRoot: repo,
    cwd: nested,
  });
  assert.deepEqual(resolveWorkspaceScope(nonGit), {
    scopeKey: nonGit,
    scopeLabel: "scratch",
    cwd: nonGit,
  });
});

test("validateWorkerWorkspace rejects missing paths and accepts git directories", async () => {
  const root = await makeTempDir("workspace-validate");
  const repo = join(root, "repo");
  await mkdir(join(repo, ".git"), { recursive: true });

  assert.deepEqual(validateWorkerWorkspace(join(root, "missing")).errors, [`Workspace path does not exist: ${join(root, "missing")}`]);

  const result = validateWorkerWorkspace(repo);
  assert.deepEqual(result.errors, []);
  assert.equal(result.gitRoot, repo);
});

test("discoverWorkspaceCandidates is bounded and includes current, git root, and sibling repos", async () => {
  const root = await makeTempDir("workspace-discover");
  const repo = join(root, "repo");
  const nested = join(repo, "packages", "app");
  const sibling = join(root, "sibling-repo");
  await mkdir(join(repo, ".git"), { recursive: true });
  await mkdir(nested, { recursive: true });
  await mkdir(join(sibling, ".git"), { recursive: true });

  const candidates = discoverWorkspaceCandidates({ currentCwd: nested, maxCandidates: 10 });
  const paths = candidates.map((candidate) => candidate.path);

  assert.equal(paths[0], nested);
  assert.ok(paths.includes(repo));
  assert.ok(paths.includes(sibling));
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(paths.length <= 10);
});

test("validateWorkerWorkspace warns when Jira-like tasks target the extension repo", async () => {
  const root = await makeTempDir("workspace-warning");
  const repo = join(root, "gi-agent-workers");
  await mkdir(join(repo, ".git"), { recursive: true });

  const result = validateWorkerWorkspace(repo, { task: "Plan Jira issue WIN-2579 for Wingo" });

  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((warning) => warning.includes("extension repo")));
});

test("formatWorkspaceStatusLines shows current workspace without selected state", () => {
  const lines = formatWorkspaceStatusLines("/tmp/current");

  assert.ok(lines.some((line) => line.includes("current: /tmp/current")));
  assert.equal(lines.some((line) => line.includes("selected:")), false);
});

async function makeTempDir(name: string): Promise<string> {
  const root = join(tmpdir(), `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(root, { recursive: true });
  await writeFile(join(root, ".keep"), "");
  return root;
}
