import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatTraceList, listTraceSummaries } from "./traces.ts";

test("listTraceSummaries returns recent trace files with counts and last event", async () => {
	const dir = await mkdtemp(join(tmpdir(), "agent-lens-traces-"));
	try {
		const oldTrace = join(dir, "agent-lens-old.jsonl");
		const newTrace = join(dir, "agent-lens-new.jsonl");
		await writeFile(oldTrace, JSON.stringify({ timestamp: "2026-06-07T01:00:00.000Z", event: "agent_start" }) + "\n", "utf8");
		await writeFile(
			newTrace,
			[
				{ timestamp: "2026-06-07T02:00:00.000Z", event: "before_agent_start" },
				{ timestamp: "2026-06-07T02:00:01.000Z", event: "context" },
			].map((record) => JSON.stringify(record)).join("\n") + "\n",
			"utf8",
		);

		const summaries = await listTraceSummaries(dir);

		assert.equal(summaries.length, 2);
		assert.equal(summaries[0].traceFile, newTrace);
		assert.equal(summaries[0].recordCount, 2);
		assert.equal(summaries[0].lastEvent, "context");
		assert.equal(summaries[0].lastTimestamp, "2026-06-07T02:00:01.000Z");
		assert.equal(typeof summaries[0].sizeBytes, "number");
		assert.equal(typeof summaries[0].modifiedAt, "string");
		assert.equal(summaries[1].traceFile, oldTrace);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("formatTraceList produces compact user-facing trace summaries and marks active trace", () => {
	const text = formatTraceList([
		{ traceFile: "/repo/.pi-agent-lens/agent-lens-new.jsonl", recordCount: 2, lastEvent: "context", lastTimestamp: "2026-06-07T02:00:01.000Z", sizeBytes: 20, modifiedAt: "2026-06-07T02:00:02.000Z" },
		{ traceFile: "/repo/.pi-agent-lens/agent-lens-old.jsonl", recordCount: 1, lastEvent: "agent_start", lastTimestamp: "2026-06-07T01:00:00.000Z", sizeBytes: 10, modifiedAt: "2026-06-07T01:00:02.000Z" },
	], { activeTraceFile: "/repo/.pi-agent-lens/agent-lens-old.jsonl" });

	assert.match(text, /Agent Lens traces/);
	assert.match(text, /agent-lens-new.jsonl/);
	assert.match(text, /2 records/);
	assert.match(text, /last=context/);
	assert.match(text, /20 B/);
	assert.match(text, /modified=2026-06-07T02:00:02.000Z/);
	assert.match(text, /\* agent-lens-old.jsonl/);
	assert.match(text, /\* = active trace/);
});

test("formatTraceList handles empty directories", () => {
	assert.equal(formatTraceList([]), "No Agent Lens traces found.");
});
