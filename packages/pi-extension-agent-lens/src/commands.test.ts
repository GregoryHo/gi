import test from "node:test";
import assert from "node:assert/strict";
import { formatReportMessage, formatStatusMessage, parseAgentLensCommand } from "./commands.ts";

test("formatStatusMessage reports trace path, raw capture, and live report status", () => {
	const message = formatStatusMessage({
		traceFile: "/repo/.pi-agent-lens/trace.jsonl",
		rawCaptureEnabled: false,
		liveReportEnabled: true,
		latestReportFile: "/repo/.pi-agent-lens/latest.html",
		configSource: "/repo/.pi-agent-lens/config.json",
		captureProfile: "redacted",
		configWarning: "unsupported captureProfile 'raw'; using redacted",
		lastError: undefined,
	});

	assert.equal(message.includes("/repo/.pi-agent-lens/trace.jsonl"), true);
	assert.equal(message.includes("raw capture: disabled"), true);
	assert.equal(message.includes("live report: enabled"), true);
	assert.equal(message.includes("latest report: /repo/.pi-agent-lens/latest.html"), true);
	assert.equal(message.includes("config source: /repo/.pi-agent-lens/config.json"), true);
	assert.equal(message.includes("capture profile: redacted"), true);
	assert.equal(message.includes("config warning: unsupported captureProfile 'raw'; using redacted"), true);
});

test("parseAgentLensCommand keeps status default and recognizes subcommands", () => {
	assert.equal(parseAgentLensCommand(""), "status");
	assert.equal(parseAgentLensCommand("   "), "status");
	assert.equal(parseAgentLensCommand("report"), "report");
	assert.equal(parseAgentLensCommand("traces"), "traces");
	assert.equal(parseAgentLensCommand("index"), "index");
	assert.equal(parseAgentLensCommand("compare"), "compare");
	assert.equal(parseAgentLensCommand("clean --dry-run"), "clean_dry_run");
	assert.equal(parseAgentLensCommand("clean --confirm"), "clean_confirm");
});

test("formatReportMessage reports generated HTML path and latest alias", () => {
	assert.equal(
		formatReportMessage("/repo/.pi-agent-lens/agent-lens.html", "/repo/.pi-agent-lens/latest.html"),
		"Agent Lens report: /repo/.pi-agent-lens/agent-lens.html\nLatest report: /repo/.pi-agent-lens/latest.html",
	);
});
