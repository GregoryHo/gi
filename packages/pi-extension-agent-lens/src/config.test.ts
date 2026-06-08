import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAgentLensConfig } from "./config.ts";

test("loadAgentLensConfig returns safe defaults with no config file", () => {
	const config = loadAgentLensConfig({ cwd: "/repo" });

	assert.equal(config.artifactRoot, join("/repo", ".pi-agent-lens"));
	assert.equal(config.liveReportRefreshSeconds, 2);
	assert.equal(config.captureProfile, "redacted");
	assert.equal(config.source, "defaults");
	assert.equal(config.warning, undefined);
});

test("loadAgentLensConfig reads project-local config", async () => {
	const dir = await mkdtemp(join(tmpdir(), "agent-lens-config-"));
	try {
		await mkdir(join(dir, ".pi-agent-lens"));
		await writeFile(join(dir, ".pi-agent-lens", "config.json"), JSON.stringify({
			artifactRoot: ".agent-lens-artifacts",
			liveReportRefreshSeconds: 7,
			captureProfile: "redacted",
			retention: { maxTraceFiles: 10, maxAgeDays: 14 },
		}), "utf8");

		const config = loadAgentLensConfig({ cwd: dir });

		assert.equal(config.artifactRoot, join(dir, ".agent-lens-artifacts"));
		assert.equal(config.liveReportRefreshSeconds, 7);
		assert.equal(config.captureProfile, "redacted");
		assert.equal(config.retention.maxTraceFiles, 10);
		assert.equal(config.retention.maxAgeDays, 14);
		assert.equal(config.source, join(dir, ".pi-agent-lens", "config.json"));
		assert.equal(config.warning, undefined);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("loadAgentLensConfig falls back to defaults for malformed config", async () => {
	const dir = await mkdtemp(join(tmpdir(), "agent-lens-bad-config-"));
	try {
		await mkdir(join(dir, ".pi-agent-lens"));
		await writeFile(join(dir, ".pi-agent-lens", "config.json"), "{ bad json", "utf8");

		const config = loadAgentLensConfig({ cwd: dir });

		assert.equal(config.artifactRoot, join(dir, ".pi-agent-lens"));
		assert.equal(config.liveReportRefreshSeconds, 2);
		assert.equal(config.captureProfile, "redacted");
		assert.match(config.warning ?? "", /config/i);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("loadAgentLensConfig rejects unsupported capture profiles safely", async () => {
	const dir = await mkdtemp(join(tmpdir(), "agent-lens-unsafe-config-"));
	try {
		await mkdir(join(dir, ".pi-agent-lens"));
		await writeFile(join(dir, ".pi-agent-lens", "config.json"), JSON.stringify({ captureProfile: "raw" }), "utf8");

		const config = loadAgentLensConfig({ cwd: dir });

		assert.equal(config.captureProfile, "redacted");
		assert.match(config.warning ?? "", /unsupported captureProfile/i);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
