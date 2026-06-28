import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createPlanArtifact } from "./artifact-types.ts";
import {
  getPlanArtifactRelativePath,
  getProjectKey,
  listPlanIndexEntries,
  readCurrentPlanPointer,
  readPlanArtifact,
  writeCurrentPlanPointer,
  writePlanArtifact,
} from "./artifacts.ts";

test("getProjectKey is deterministic and path-safe", () => {
  const key = getProjectKey("/Users/me/repo name");
  assert.match(key, /^repo-name-[a-f0-9]{8}$/);
  assert.equal(getProjectKey("/Users/me/repo name"), key);
});

test("writeCurrentPlanPointer stores only activePlanId", async () => {
  const root = await mkdtemp(join(tmpdir(), "plan-mode-test-"));
  try {
    await writeCurrentPlanPointer(root, { activePlanId: "plan_1" });
    assert.deepEqual(JSON.parse(await readFile(join(root, "current.json"), "utf8")), { activePlanId: "plan_1" });
    assert.deepEqual(await readCurrentPlanPointer(root), { activePlanId: "plan_1" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("writePlanArtifact writes artifact and upserts index metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "plan-mode-test-"));
  try {
    const plan = createPlanArtifact({
      now: new Date("2026-06-28T14:30:12.000Z"),
      cwd: "/repo",
      title: "Auth refactor",
      steps: [{ step: 1, text: "Inspect code" }],
      sessionFile: "/sessions/a.jsonl",
      sessionPlanNumber: 1,
    });

    const relativePath = await writePlanArtifact(root, plan);
    assert.equal(relativePath, "plans/2026-06/plan_20260628_143012_auth_refactor.json");
    assert.equal(getPlanArtifactRelativePath(plan), relativePath);
    assert.deepEqual((await readPlanArtifact(root, plan.id))?.id, plan.id);
    assert.deepEqual(await listPlanIndexEntries(root), [
      {
        id: plan.id,
        title: "Auth refactor",
        status: "draft",
        createdAt: "2026-06-28T14:30:12.000Z",
        updatedAt: "2026-06-28T14:30:12.000Z",
        cwd: "/repo",
        sessionFile: "/sessions/a.jsonl",
        sessionPlanNumber: 1,
        artifactPath: relativePath,
        summary: "Inspect code",
      },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("listPlanIndexEntries filters by cwd and session", async () => {
  const root = await mkdtemp(join(tmpdir(), "plan-mode-test-"));
  try {
    await writePlanArtifact(
      root,
      createPlanArtifact({ now: new Date("2026-06-28T14:30:12.000Z"), cwd: "/repo", title: "A", steps: [{ step: 1, text: "A" }], sessionFile: "s1", sessionPlanNumber: 1 }),
    );
    await writePlanArtifact(
      root,
      createPlanArtifact({ now: new Date("2026-06-28T15:30:12.000Z"), cwd: "/repo", title: "B", steps: [{ step: 1, text: "B" }], sessionFile: "s2", sessionPlanNumber: 1 }),
    );

    assert.equal((await listPlanIndexEntries(root, { cwd: "/repo" })).length, 2);
    assert.deepEqual((await listPlanIndexEntries(root, { sessionFile: "s1" })).map((entry) => entry.title), ["A"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
