import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";

import { createDemoAdapter } from "./adapters/demo.ts";
import { WorkerManager } from "./worker-manager.ts";
import type { ChildProcessLike, SpawnLike, WorkerAdapter } from "./worker-types.ts";

class FakeChildProcess extends EventEmitter implements ChildProcessLike {
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  killed = false;
  killSignal: NodeJS.Signals | undefined;

  readonly pid: number;

  constructor(pid: number) {
    super();
    this.pid = pid;
  }

  kill(signal?: NodeJS.Signals): boolean {
    this.killed = true;
    this.killSignal = signal;
    return true;
  }
}

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "agent-workers-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const testAdapter: WorkerAdapter = {
  name: "test",
  createSpawnSpec(task, cwd) {
    return { command: "worker-test-bin", args: [task], cwd };
  },
};

test("WorkerManager validates adapters before spawning", async () => {
  await withTempDir(async (artifactRoot) => {
    let spawned = false;
    const adapter: WorkerAdapter = {
      name: "missing",
      createSpawnSpec(task, cwd) {
        return { command: "missing-bin", args: [task], cwd };
      },
      async validate() {
        throw new Error("worker CLI missing");
      },
    };
    const manager = new WorkerManager({
      artifactRoot,
      adapters: [adapter],
      spawn: () => {
        spawned = true;
        return new FakeChildProcess(1111);
      },
    });

    await assert.rejects(manager.startRun({ adapter: "missing", task: "hello", cwd: "/tmp/project" }), /worker CLI missing/);
    assert.equal(spawned, false);
  });
});

test("WorkerManager notifies run changes on start and terminal update", async () => {
  await withTempDir(async (artifactRoot) => {
    const child = new FakeChildProcess(4242);
    const statuses: string[] = [];
    const manager = new WorkerManager({
      artifactRoot,
      adapters: [testAdapter],
      spawn: () => child,
      onRunChange: (run) => statuses.push(run.status),
    });

    const run = await manager.startRun({ adapter: "test", task: "notify me", cwd: "/tmp/project" });
    child.emit("close", 0);
    await manager.waitForRun(run.id);

    assert.deepEqual(statuses, ["running", "completed"]);
  });
});

test("WorkerManager indexes run metadata on start and terminal update", async () => {
  await withTempDir(async (artifactRoot) => {
    const child = new FakeChildProcess(4141);
    const manager = new WorkerManager({ artifactRoot, adapters: [testAdapter], spawn: () => child });

    const run = await manager.startRun({ adapter: "test", task: "full secret task text", cwd: "/tmp/project" });
    let history = await manager.listRunHistory();
    assert.equal(history[0]?.runId, run.id);
    assert.equal(history[0]?.status, "running");
    assert.equal(history[0]?.controllable, true);

    child.emit("close", 0);
    await manager.waitForRun(run.id);

    history = await manager.listRunHistory();
    assert.equal(history[0]?.runId, run.id);
    assert.equal(history[0]?.status, "completed");
    assert.equal(history[0]?.statusReason, "exit_zero");
    assert.equal(history[0]?.controllable, true);
  });
});

test("WorkerManager starts one run, records lifecycle state, and captures logs", async () => {
  await withTempDir(async (artifactRoot) => {
    const child = new FakeChildProcess(4242);
    const calls: Array<{ command: string; args: string[]; cwd: string; shell: boolean }> = [];
    const spawn: SpawnLike = (command, args, options) => {
      calls.push({ command, args, cwd: options.cwd, shell: options.shell });
      return child;
    };
    const manager = new WorkerManager({ artifactRoot, adapters: [testAdapter], spawn });

    const run = await manager.startRun({ adapter: "test", task: "hello worker", cwd: "/tmp/project" });

    assert.equal(run.status, "running");
    assert.equal(run.pid, 4242);
    assert.equal(run.adapter, "test");
    assert.equal(run.taskPreview, "hello worker");
    assert.equal(run.usage.source, "unknown");
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      command: "worker-test-bin",
      args: ["hello worker"],
      cwd: "/tmp/project",
      shell: false,
    });

    child.stdout.write("stdout line\n");
    child.stderr.write("stderr line\n");
    child.emit("close", 0);

    const finished = await manager.waitForRun(run.id);
    assert.equal(finished.status, "completed");
    assert.equal(finished.exitCode, 0);
    assert.ok(finished.endedAt);
    assert.match(finished.logPath, /runs\/.+\/output\.log$/);

    const log = await readFile(finished.logPath, "utf8");
    assert.match(log, /\[stdout\] stdout line/);
    assert.match(log, /\[stderr\] stderr line/);
  });
});

test("WorkerManager applies parsed worker events to usage and summaries", async () => {
  await withTempDir(async (artifactRoot) => {
    const child = new FakeChildProcess(4444);
    const adapter: WorkerAdapter = {
      name: "json-test",
      createSpawnSpec(task, cwd) {
        return { command: "worker-test-bin", args: [task], cwd };
      },
      parseOutputLine(line, stream, timestamp) {
        assert.equal(stream, "stdout");
        assert.equal(line, "event-line");
        return [
          { type: "activity", label: "parsed activity", timestamp },
          { type: "final", text: "OK", timestamp },
          { type: "usage", usage: { source: "reported", inputTokens: 1, outputTokens: 2 }, timestamp },
        ];
      },
    };
    const manager = new WorkerManager({ artifactRoot, adapters: [adapter], spawn: () => child });

    const run = await manager.startRun({ adapter: "json-test", task: "parse me", cwd: "/tmp/project" });
    child.stdout.write("event-line\n");
    child.emit("close", 0);

    const finished = await manager.waitForRun(run.id);
    assert.equal(finished.usage.source, "reported");
    assert.equal(finished.usage.inputTokens, 1);
    assert.equal(finished.usage.outputTokens, 2);
    assert.deepEqual(finished.activity, ["parsed activity"]);
    assert.equal(finished.finalTextPreview, "OK");
  });
});

test("WorkerManager marks non-zero exits as failed and keeps exit code", async () => {
  await withTempDir(async (artifactRoot) => {
    const child = new FakeChildProcess(4343);
    const manager = new WorkerManager({ artifactRoot, adapters: [testAdapter], spawn: () => child });

    const run = await manager.startRun({ adapter: "test", task: "fail me", cwd: "/tmp/project" });
    child.emit("close", 7);

    const finished = await manager.waitForRun(run.id);
    assert.equal(finished.status, "failed");
    assert.equal(finished.exitCode, 7);
  });
});

test("WorkerManager supports six concurrent safe workers and rejects the seventh", async () => {
  await withTempDir(async (artifactRoot) => {
    let pid = 1000;
    const manager = new WorkerManager({ artifactRoot, adapters: [testAdapter], spawn: () => new FakeChildProcess(pid++) });

    const runs = [];
    for (let index = 0; index < 6; index++) {
      runs.push(await manager.startRun({ adapter: "test", task: `worker ${index}`, cwd: "/tmp/project" }));
    }

    assert.deepEqual(runs.map((run) => run.slot), [1, 2, 3, 4, 5, 6]);
    assert.equal(manager.listRuns().filter((run) => run.status === "running").length, 6);
    await assert.rejects(
      manager.startRun({ adapter: "test", task: "seventh", cwd: "/tmp/project" }),
      /maximum of 6 active workers/i,
    );
  });
});

test("WorkerManager allows read-only workers in the same workspace", async () => {
  await withTempDir(async (artifactRoot) => {
    let pid = 2000;
    const manager = new WorkerManager({ artifactRoot, adapters: [testAdapter], spawn: () => new FakeChildProcess(pid++) });

    const first = await manager.startRun({ adapter: "test", task: "verify one", cwd: "/tmp/project", readOnly: true, canModifyWorkspace: false, workspaceKey: "/tmp/project" });
    const second = await manager.startRun({ adapter: "test", task: "verify two", cwd: "/tmp/project", readOnly: true, canModifyWorkspace: false, workspaceKey: "/tmp/project" });

    assert.equal(first.slot, 1);
    assert.equal(second.slot, 2);
  });
});

test("WorkerManager blocks write-capable workers in the same workspace", async () => {
  await withTempDir(async (artifactRoot) => {
    const manager = new WorkerManager({ artifactRoot, adapters: [testAdapter], spawn: () => new FakeChildProcess(3000) });

    await manager.startRun({ adapter: "test", task: "write one", cwd: "/tmp/project", readOnly: false, canModifyWorkspace: true, workspaceKey: "/tmp/project" });
    await assert.rejects(
      manager.startRun({ adapter: "test", task: "write two", cwd: "/tmp/project", readOnly: false, canModifyWorkspace: true, workspaceKey: "/tmp/project" }),
      /write-capable worker is already active/i,
    );
  });
});

test("WorkerManager allows write-capable workers in distinct workspaces", async () => {
  await withTempDir(async (artifactRoot) => {
    let pid = 4000;
    const manager = new WorkerManager({ artifactRoot, adapters: [testAdapter], spawn: () => new FakeChildProcess(pid++) });

    const first = await manager.startRun({ adapter: "test", task: "write one", cwd: "/tmp/project-a", readOnly: false, canModifyWorkspace: true, workspaceKey: "/tmp/project-a" });
    const second = await manager.startRun({ adapter: "test", task: "write two", cwd: "/tmp/project-b", readOnly: false, canModifyWorkspace: true, workspaceKey: "/tmp/project-b" });

    assert.equal(first.slot, 1);
    assert.equal(second.slot, 2);
  });
});

test("WorkerManager does not kill an already completed worker", async () => {
  await withTempDir(async (artifactRoot) => {
    const child = new FakeChildProcess(5353);
    const manager = new WorkerManager({ artifactRoot, adapters: [testAdapter], spawn: () => child });

    const run = await manager.startRun({ adapter: "test", task: "already done", cwd: "/tmp/project" });
    child.emit("close", 0);
    await manager.waitForRun(run.id);

    const result = manager.cancelRun(run.id);
    assert.equal(result.status, "completed");
    assert.equal(child.killed, false);
  });
});

test("WorkerManager cancels a running worker", async () => {
  await withTempDir(async (artifactRoot) => {
    const child = new FakeChildProcess(5252);
    const manager = new WorkerManager({ artifactRoot, adapters: [testAdapter], spawn: () => child });

    const run = await manager.startRun({ adapter: "test", task: "cancel me", cwd: "/tmp/project" });
    const cancelled = manager.cancelRun(run.id);

    assert.equal(cancelled.status, "cancelled");
    assert.equal(child.killed, true);
    assert.equal(child.killSignal, "SIGTERM");

    child.emit("close", null);
    const finished = await manager.waitForRun(run.id);
    assert.equal(finished.status, "cancelled");
    const history = await manager.listRunHistory();
    assert.equal(history[0]?.runId, run.id);
    assert.equal(history[0]?.status, "cancelled");
    assert.equal(history[0]?.statusReason, "cancelled");
  });
});

test("WorkerManager times out a running worker distinctly from cancellation", async () => {
  await withTempDir(async (artifactRoot) => {
    const child = new FakeChildProcess(6262);
    const manager = new WorkerManager({ artifactRoot, adapters: [testAdapter], spawn: () => child });

    const run = await manager.startRun({ adapter: "test", task: "timeout me", cwd: "/tmp/project", timeoutMs: 5 });
    assert.equal(run.timeoutMs, 5);

    await new Promise((resolve) => setTimeout(resolve, 20));

    const timedOut = manager.getRun(run.id);
    assert.equal(timedOut?.status, "timed_out");
    assert.equal(timedOut?.statusReason, "timed_out");
    assert.equal(child.killed, true);
    assert.equal(child.killSignal, "SIGTERM");

    child.emit("close", null);
    const finished = await manager.waitForRun(run.id);
    assert.equal(finished.status, "timed_out");
    assert.equal(finished.statusReason, "timed_out");
    assert.ok(finished.endedAt);
  });
});

test("WorkerManager cancelAll cancels all active workers", async () => {
  await withTempDir(async (artifactRoot) => {
    const children = [new FakeChildProcess(7001), new FakeChildProcess(7002)];
    const spawned: FakeChildProcess[] = [];
    const manager = new WorkerManager({
      artifactRoot,
      adapters: [testAdapter],
      spawn: () => {
        const child = children.shift() ?? new FakeChildProcess(7003);
        spawned.push(child);
        return child;
      },
    });

    const first = await manager.startRun({ adapter: "test", task: "first", cwd: "/tmp/project" });
    const second = await manager.startRun({ adapter: "test", task: "second", cwd: "/tmp/project" });
    manager.cancelAll();

    assert.deepEqual(manager.listRuns().map((run) => run.status), ["cancelled", "cancelled"]);
    for (const child of spawned) child.emit("close", null);
    await Promise.all([manager.waitForRun(first.id), manager.waitForRun(second.id)]);
  });
});

test("createDemoAdapter uses the current Node executable without shell interpolation", () => {
  const adapter = createDemoAdapter({ nodePath: "/usr/bin/node" });
  const spec = adapter.createSpawnSpec("hello; rm -rf /", "/tmp/project", { durationMs: 10000 });

  assert.equal(spec.command, "/usr/bin/node");
  assert.equal(spec.cwd, "/tmp/project");
  assert.equal(spec.shell, false);
  assert.ok(spec.args.includes("hello; rm -rf /"));
  assert.ok(spec.args.includes("10000"));
});
