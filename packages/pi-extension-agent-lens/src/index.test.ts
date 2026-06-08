import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import agentLens from "./index.ts";

test("agentLens registers read-only lifecycle observers and command", () => {
	const events: string[] = [];
	const commands: string[] = [];
	const pi = {
		on(event: string) {
			events.push(event);
		},
		registerCommand(name: string) {
			commands.push(name);
		},
	} as any;

	agentLens(pi);

	assert.deepEqual(commands, ["agent-lens"]);
	for (const event of [
		"before_agent_start",
		"agent_start",
		"agent_end",
		"turn_start",
		"turn_end",
		"context",
		"before_provider_request",
		"session_before_compact",
		"session_compact",
	]) {
		assert.equal(events.includes(event), true, `${event} should be registered`);
	}
});

test("registered handlers write redacted JSONL trace records", async () => {
	const originalCwd = process.cwd();
	const dir = await mkdtemp(join(tmpdir(), "agent-lens-index-"));
	try {
		process.chdir(dir);
		const handlers = new Map<string, Function>();
		const pi = {
			on(event: string, handler: Function) {
				handlers.set(event, handler);
			},
			registerCommand() {},
		} as any;

		agentLens(pi);

		const result = handlers.get("before_agent_start")?.({
			prompt: "raw secret prompt",
			images: [],
			systemPrompt: "raw system prompt",
			systemPromptOptions: { cwd: dir, contextFiles: [{ path: "AGENTS.md", content: "raw project rule" }] },
		});
		assert.equal(result, undefined);
		handlers.get("context")?.({ messages: [{ role: "user", content: "raw context secret", timestamp: 1 }] });

		const files = await readdir(join(dir, ".pi-agent-lens"));
		assert.equal(files.length, 1);
		const trace = await readFile(join(dir, ".pi-agent-lens", files[0]), "utf8");

		assert.equal(trace.includes("before_agent_start"), true);
		assert.equal(trace.includes("context"), true);
		assert.equal(trace.includes("raw secret prompt"), false);
		assert.equal(trace.includes("raw system prompt"), false);
		assert.equal(trace.includes("raw context secret"), false);
		assert.equal(trace.includes("raw project rule"), false);
	} finally {
		process.chdir(originalCwd);
		await rm(dir, { recursive: true, force: true });
	}
});

test("agent-lens report command writes an HTML report for the active trace", async () => {
	const originalCwd = process.cwd();
	const dir = await mkdtemp(join(tmpdir(), "agent-lens-report-command-"));
	try {
		process.chdir(dir);
		let commandHandler: ((args: string, ctx: any) => Promise<void>) | undefined;
		const notifications: string[] = [];
		const pi = {
			on() {},
			registerCommand(_name: string, options: any) {
				commandHandler = options.handler;
			},
		} as any;

		agentLens(pi);
		assert.ok(commandHandler);
		await commandHandler("report", { ui: { notify: (message: string) => notifications.push(message) } });

		const files = await readdir(join(dir, ".pi-agent-lens"));
		assert.equal(files.some((file) => file.endsWith(".html")), true);
		assert.equal(notifications.some((message) => message.includes("Agent Lens report:")), true);
		assert.equal(notifications.some((message) => message.includes("Latest report:")), true);
	} finally {
		process.chdir(originalCwd);
		await rm(dir, { recursive: true, force: true });
	}
});

test("agentLens uses local config for artifact root, report refresh, and status", async () => {
	const originalCwd = process.cwd();
	const dir = await mkdtemp(join(tmpdir(), "agent-lens-configured-index-"));
	try {
		process.chdir(dir);
		await mkdir(join(dir, ".pi-agent-lens"));
		await writeFile(
			join(dir, ".pi-agent-lens", "config.json"),
			JSON.stringify({ artifactRoot: ".configured-agent-lens", liveReportRefreshSeconds: 7 }),
			"utf8",
		);
		let commandHandler: ((args: string, ctx: any) => Promise<void>) | undefined;
		const notifications: string[] = [];
		const pi = {
			on() {},
			registerCommand(_name: string, options: any) {
				commandHandler = options.handler;
			},
		} as any;

		agentLens(pi);
		assert.ok(commandHandler);
		await commandHandler("report", { ui: { notify: (message: string) => notifications.push(message) } });
		await commandHandler("", { ui: { notify: (message: string) => notifications.push(message) } });

		const reportPath = notifications[0].split("\n")[0].replace("Agent Lens report: ", "");
		const html = await readFile(reportPath, "utf8");
		assert.equal(reportPath.includes(".configured-agent-lens"), true);
		assert.match(html, /<meta http-equiv="refresh" content="7">/);
		assert.equal(notifications.some((message) => message.includes("config source:")), true);
		assert.equal(notifications.some((message) => message.includes("capture profile: redacted")), true);
	} finally {
		process.chdir(originalCwd);
		await rm(dir, { recursive: true, force: true });
	}
});

test("agentLens reports malformed config as a status warning", async () => {
	const originalCwd = process.cwd();
	const dir = await mkdtemp(join(tmpdir(), "agent-lens-bad-config-index-"));
	try {
		process.chdir(dir);
		await mkdir(join(dir, ".pi-agent-lens"));
		await writeFile(join(dir, ".pi-agent-lens", "config.json"), "{ bad json", "utf8");
		let commandHandler: ((args: string, ctx: any) => Promise<void>) | undefined;
		const notifications: Array<{ message: string; type: string }> = [];
		const pi = {
			on() {},
			registerCommand(_name: string, options: any) {
				commandHandler = options.handler;
			},
		} as any;

		agentLens(pi);
		assert.ok(commandHandler);
		await commandHandler("", { ui: { notify: (message: string, type: string) => notifications.push({ message, type }) } });

		assert.equal(notifications[0].type, "warning");
		assert.match(notifications[0].message, /config warning:/);
		assert.match(notifications[0].message, /capture profile: redacted/);
	} finally {
		process.chdir(originalCwd);
		await rm(dir, { recursive: true, force: true });
	}
});

test("agent-lens index command writes a multi-trace index report", async () => {
	const originalCwd = process.cwd();
	const dir = await mkdtemp(join(tmpdir(), "agent-lens-index-command-"));
	try {
		process.chdir(dir);
		let commandHandler: ((args: string, ctx: any) => Promise<void>) | undefined;
		const notifications: string[] = [];
		const pi = {
			on() {},
			registerCommand(_name: string, options: any) {
				commandHandler = options.handler;
			},
		} as any;

		agentLens(pi);
		assert.ok(commandHandler);
		await commandHandler("report", { ui: { notify: (message: string) => notifications.push(message) } });
		await commandHandler("index", { ui: { notify: (message: string) => notifications.push(message) } });

		const indexPath = join(dir, ".pi-agent-lens", "index.html");
		const html = await readFile(indexPath, "utf8");
		assert.match(html, /Agent Lens Index/);
		assert.match(html, /active/);
		assert.equal(notifications.some((message) => message.includes("Agent Lens index:")), true);
	} finally {
		process.chdir(originalCwd);
		await rm(dir, { recursive: true, force: true });
	}
});

test("agent-lens clean commands dry-run and confirm retention cleanup", async () => {
	const originalCwd = process.cwd();
	const dir = await mkdtemp(join(tmpdir(), "agent-lens-clean-command-"));
	try {
		process.chdir(dir);
		await mkdir(join(dir, ".pi-agent-lens"));
		await writeFile(join(dir, ".pi-agent-lens", "config.json"), JSON.stringify({ retention: { maxAgeDays: 1 } }), "utf8");
		const oldTrace = join(dir, ".pi-agent-lens", "agent-lens-old.jsonl");
		await writeFile(oldTrace, JSON.stringify({ timestamp: "2000-01-01T00:00:00.000Z", event: "context" }) + "\n", "utf8");
		let commandHandler: ((args: string, ctx: any) => Promise<void>) | undefined;
		const notifications: string[] = [];
		const pi = {
			on() {},
			registerCommand(_name: string, options: any) {
				commandHandler = options.handler;
			},
		} as any;

		agentLens(pi);
		assert.ok(commandHandler);
		await commandHandler("clean --dry-run", { ui: { notify: (message: string) => notifications.push(message) } });
		assert.equal(await readFile(oldTrace, "utf8").then(() => true), true);
		assert.equal(notifications.some((message) => message.includes("Would delete")), true);

		await commandHandler("clean --confirm", { ui: { notify: (message: string) => notifications.push(message) } });
		await assert.rejects(readFile(oldTrace, "utf8"), /ENOENT/);
		assert.equal(notifications.some((message) => message.includes("Deleted 1 Agent Lens cleanup file")), true);
	} finally {
		process.chdir(originalCwd);
		await rm(dir, { recursive: true, force: true });
	}
});

test("agent-lens traces command lists available traces", async () => {
	const originalCwd = process.cwd();
	const dir = await mkdtemp(join(tmpdir(), "agent-lens-traces-command-"));
	try {
		process.chdir(dir);
		let commandHandler: ((args: string, ctx: any) => Promise<void>) | undefined;
		const notifications: string[] = [];
		const pi = {
			on() {},
			registerCommand(_name: string, options: any) {
				commandHandler = options.handler;
			},
		} as any;

		agentLens(pi);
		assert.ok(commandHandler);
		await commandHandler("report", { ui: { notify: (message: string) => notifications.push(message) } });
		await commandHandler("traces", { ui: { notify: (message: string) => notifications.push(message) } });

		assert.equal(notifications.some((message) => message.includes("Agent Lens traces:")), true);
		assert.equal(notifications.some((message) => message.includes("report_requested")), true);
	} finally {
		process.chdir(originalCwd);
		await rm(dir, { recursive: true, force: true });
	}
});

test("live HTML report updates after later trace events", async () => {
	const originalCwd = process.cwd();
	const dir = await mkdtemp(join(tmpdir(), "agent-lens-live-report-"));
	try {
		process.chdir(dir);
		let commandHandler: ((args: string, ctx: any) => Promise<void>) | undefined;
		const handlers = new Map<string, Function>();
		const notifications: string[] = [];
		const pi = {
			on(event: string, handler: Function) {
				handlers.set(event, handler);
			},
			registerCommand(_name: string, options: any) {
				commandHandler = options.handler;
			},
		} as any;

		agentLens(pi);
		assert.ok(commandHandler);
		await commandHandler("report", { ui: { notify: (message: string) => notifications.push(message) } });
		const reportPath = notifications[0].split("\n")[0].replace("Agent Lens report: ", "");

		handlers.get("before_agent_start")?.({
			prompt: "later raw prompt",
			images: [],
			systemPrompt: "later raw system prompt",
			systemPromptOptions: { cwd: dir },
		});

		const html = await waitForFileToContain(reportPath, "before_agent_start");
		assert.match(html, /<meta http-equiv="refresh" content="2">/);
		assert.equal(html.includes("later raw prompt"), false);
		assert.equal(html.includes("later raw system prompt"), false);
	} finally {
		process.chdir(originalCwd);
		await rm(dir, { recursive: true, force: true });
	}
});

async function waitForFileToContain(path: string, needle: string): Promise<string> {
	for (let i = 0; i < 20; i++) {
		const text = await readFile(path, "utf8");
		if (text.includes(needle)) return text;
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	return await readFile(path, "utf8");
}
