import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { getRunLogPath, readLogTail } from "./logs.ts";

test("getRunLogPath places logs under the local runs directory", () => {
  const logPath = getRunLogPath("/tmp/artifacts", "run_123");
  assert.equal(logPath, "/tmp/artifacts/runs/run_123/output.log");
});

test("readLogTail returns only the requested trailing lines", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-worker-log-test-"));
  try {
    const file = join(dir, "output.log");
    await writeFile(file, "one\ntwo\nthree\nfour\n", "utf8");

    assert.equal(await readLogTail(file, 2), "three\nfour");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
