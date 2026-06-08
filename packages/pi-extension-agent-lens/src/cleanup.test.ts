import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeCleanupPlan, formatCleanupPlan, planCleanup } from "./cleanup.ts";

const now = new Date("2026-06-07T12:00:00.000Z");

test("planCleanup selects old traces by maxTraceFiles and protects active trace", async () => {
	const dir = await mkdtemp(join(tmpdir(), "agent-lens-clean-plan-"));
	try {
		const active = join(dir, "agent-lens-active.jsonl");
		const old = join(dir, "agent-lens-old.jsonl");
		const older = join(dir, "agent-lens-older.jsonl");
		await writeFile(active, JSON.stringify({ timestamp: "2026-06-07T03:00:00.000Z", event: "context" }) + "\n", "utf8");
		await writeFile(old, JSON.stringify({ timestamp: "2026-06-07T02:00:00.000Z", event: "context" }) + "\n", "utf8");
		await writeFile(older, JSON.stringify({ timestamp: "2026-06-07T01:00:00.000Z", event: "context" }) + "\n", "utf8");
		await writeFile(older.replace(/\.jsonl$/u, ".html"), "<html></html>", "utf8");

		const plan = await planCleanup({
			artifactRoot: dir,
			activeTraceFile: active,
			retention: { maxTraceFiles: 2, maxAgeDays: null },
			now,
		});

		assert.equal(plan.deleteFiles.includes(active), false);
		assert.equal(plan.deleteFiles.includes(old), false);
		assert.equal(plan.deleteFiles.includes(older), true);
		assert.equal(plan.deleteFiles.includes(older.replace(/\.jsonl$/u, ".html")), true);
		assert.match(formatCleanupPlan(plan), /Would delete 2 files/);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("executeCleanupPlan deletes only planned files", async () => {
	const dir = await mkdtemp(join(tmpdir(), "agent-lens-clean-execute-"));
	try {
		const keep = join(dir, "agent-lens-keep.jsonl");
		const remove = join(dir, "agent-lens-remove.jsonl");
		await writeFile(keep, "keep", "utf8");
		await writeFile(remove, "remove", "utf8");

		await executeCleanupPlan({ deleteFiles: [remove], protectedFiles: [keep], reasons: new Map([[remove, "old trace"]]) });

		assert.equal(await readFile(keep, "utf8"), "keep");
		await assert.rejects(readFile(remove, "utf8"), /ENOENT/);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("planCleanup selects traces older than maxAgeDays", async () => {
	const dir = await mkdtemp(join(tmpdir(), "agent-lens-clean-age-"));
	try {
		const recent = join(dir, "agent-lens-recent.jsonl");
		const old = join(dir, "agent-lens-old.jsonl");
		await writeFile(recent, JSON.stringify({ timestamp: "2026-06-06T12:00:00.000Z", event: "context" }) + "\n", "utf8");
		await writeFile(old, JSON.stringify({ timestamp: "2026-06-01T12:00:00.000Z", event: "context" }) + "\n", "utf8");

		const plan = await planCleanup({
			artifactRoot: dir,
			activeTraceFile: recent,
			retention: { maxTraceFiles: null, maxAgeDays: 3 },
			now,
		});

		assert.equal(plan.deleteFiles.includes(recent), false);
		assert.equal(plan.deleteFiles.includes(old), true);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
