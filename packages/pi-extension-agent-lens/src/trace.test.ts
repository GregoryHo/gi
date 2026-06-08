import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTraceRecorder, getDefaultArtifactRoot } from "./trace.ts";

test("getDefaultArtifactRoot uses the project-local Agent Lens directory", () => {
	assert.equal(getDefaultArtifactRoot("/repo"), join("/repo", ".pi-agent-lens"));
});

test("TraceRecorder can write to a configured artifact root", async () => {
	const dir = await mkdtemp(join(tmpdir(), "agent-lens-trace-root-"));
	try {
		const artifactRoot = join(dir, "custom-artifacts");
		const recorder = createTraceRecorder({ artifactRoot, now: () => new Date("2026-06-07T03:18:57.000Z") });

		await recorder.record("event", { ok: true });

		assert.equal(recorder.traceFile, join(artifactRoot, "agent-lens-20260607T031857.jsonl"));
		const text = await readFile(recorder.traceFile, "utf8");
		assert.match(text, /"event":"event"/);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("TraceRecorder appends schema-versioned JSONL records", async () => {
	const dir = await mkdtemp(join(tmpdir(), "agent-lens-"));
	try {
		const recorder = createTraceRecorder({ cwd: dir, now: () => new Date("2026-06-07T00:00:00.000Z") });

		await recorder.record("agent_start", { runIndex: 1 });
		await recorder.record("agent_end", { messageCount: 2 });

		const text = await readFile(recorder.traceFile, "utf8");
		const lines = text.trim().split("\n").map((line) => JSON.parse(line));

		assert.equal(lines.length, 2);
		assert.equal(lines[0].schemaVersion, 1);
		assert.equal(lines[0].event, "agent_start");
		assert.equal(lines[0].timestamp, "2026-06-07T00:00:00.000Z");
		assert.equal(lines[0].data.runIndex, 1);
		assert.equal(lines[1].event, "agent_end");
		assert.equal(lines[1].data.messageCount, 2);
		assert.match(recorder.traceFile, /\.pi-agent-lens\/agent-lens-20260607T000000\.jsonl$/);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
