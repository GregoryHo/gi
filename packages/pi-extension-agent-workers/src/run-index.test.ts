import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { RunArtifactIndex, getRunIndexPath, workerRunToHistoryEntry } from "./run-index.ts";
import type { WorkerRun } from "./worker-types.ts";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "agent-workers-index-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("RunArtifactIndex upserts one compact latest summary per run", async () => {
  await withTempDir(async (artifactRoot) => {
    const index = new RunArtifactIndex(artifactRoot, { maxEntries: 100 });
    await index.upsertRun(makeRun({ status: "running" }));
    await index.upsertRun(makeRun({ status: "completed", endedAt: 2000, exitCode: 0 }));

    const entries = await index.listRuns();

    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.runId, "run_index");
    assert.equal(entries[0]?.status, "completed");
    assert.equal(entries[0]?.exitCode, 0);
    assert.equal(entries[0]?.controllable, false);
    assert.equal(entries[0]?.historical, true);
  });
});

test("RunArtifactIndex persists workspace scope metadata", async () => {
  await withTempDir(async (artifactRoot) => {
    const index = new RunArtifactIndex(artifactRoot);
    await index.upsertRun(makeRun({ scopeKey: "/tmp/project", scopeLabel: "project", gitRoot: "/tmp/project" } as Partial<WorkerRun>));

    const entries = await index.listRuns();

    assert.equal(entries[0]?.scopeKey, "/tmp/project");
    assert.equal(entries[0]?.scopeLabel, "project");
    assert.equal(entries[0]?.gitRoot, "/tmp/project");
  });
});

test("RunArtifactIndex filters recent runs by workspace scope", async () => {
  await withTempDir(async (artifactRoot) => {
    const index = new RunArtifactIndex(artifactRoot);
    await index.upsertRun(makeRun({ id: "run_a", scopeKey: "/tmp/project-a", scopeLabel: "project-a" } as Partial<WorkerRun>));
    await index.upsertRun(makeRun({ id: "run_b", scopeKey: "/tmp/project-b", scopeLabel: "project-b" } as Partial<WorkerRun>));

    const scoped = await index.listRuns({ scopeKey: "/tmp/project-a" });
    const all = await index.listRuns({ allScopes: true });

    assert.deepEqual(scoped.map((entry) => entry.runId), ["run_a"]);
    assert.deepEqual(all.map((entry) => entry.runId).sort(), ["run_a", "run_b"]);
  });
});

test("RunArtifactIndex filters legacy entries by workspaceKey or cwd when scope metadata is missing", async () => {
  await withTempDir(async (artifactRoot) => {
    const index = new RunArtifactIndex(artifactRoot);
    await index.upsertRun(makeRun({ id: "run_workspace_key", workspaceKey: "/tmp/project-a", cwd: "/tmp/project-a" }));
    await index.upsertRun(makeRun({ id: "run_cwd", cwd: "/tmp/project-b" }));

    const byWorkspaceKey = await index.listRuns({ scopeKey: "/tmp/project-a" });
    const byCwd = await index.listRuns({ scopeKey: "/tmp/project-b" });

    assert.deepEqual(byWorkspaceKey.map((entry) => entry.runId), ["run_workspace_key"]);
    assert.deepEqual(byCwd.map((entry) => entry.runId), ["run_cwd"]);
  });
});

test("RunArtifactIndex keeps old entries without scope metadata readable", async () => {
  await withTempDir(async (artifactRoot) => {
    const index = new RunArtifactIndex(artifactRoot);
    await index.upsertRun(makeRun({ id: "run_old" }));

    const entries = await index.listRuns({ allScopes: true });

    assert.equal(entries[0]?.runId, "run_old");
    assert.equal(entries[0]?.scopeKey, undefined);
  });
});

test("RunArtifactIndex stores compact summaries without raw task or event payloads", async () => {
  await withTempDir(async (artifactRoot) => {
    const index = new RunArtifactIndex(artifactRoot);
    await index.upsertRun(makeRun({ finalTextPreview: "OK" }));

    const raw = await readFile(getRunIndexPath(artifactRoot), "utf8");

    assert.match(raw, /"taskPreview"/);
    assert.doesNotMatch(raw, /rawEvents/);
    assert.doesNotMatch(raw, /full secret task text/);
  });
});

test("RunArtifactIndex marks historical active runs as stale instead of running", async () => {
  await withTempDir(async (artifactRoot) => {
    const index = new RunArtifactIndex(artifactRoot);
    await index.upsertRun(makeRun({ status: "running", startedAt: 1000, lastActivityAt: 1000 }));

    const entries = await index.listRuns({ allScopes: true });

    assert.equal(entries[0]?.status, "failed");
    assert.equal(entries[0]?.statusReason, "stale_historical");
    assert.equal(entries[0]?.controllable, false);
    assert.equal(entries[0]?.historical, true);
    assert.equal(entries[0]?.endedAt, 1000);
  });
});

test("workerRunToHistoryEntry marks in-memory runs as controllable", () => {
  const entry = workerRunToHistoryEntry(makeRun({ status: "running" }), { controllable: true, historical: false });

  assert.equal(entry.runId, "run_index");
  assert.equal(entry.controllable, true);
  assert.equal(entry.historical, false);
  assert.equal(entry.status, "running");
});

function makeRun(overrides: Partial<WorkerRun> = {}): WorkerRun {
  return {
    id: "run_index",
    adapter: "demo",
    mode: "custom",
    taskPreview: "preview only",
    cwd: "/tmp/project",
    pid: 1234,
    status: "running",
    startedAt: 1000,
    lastActivityAt: 1100,
    logPath: "/tmp/run/output.log",
    usage: { source: "unknown" },
    activity: ["stdout line"],
    ...overrides,
  };
}
