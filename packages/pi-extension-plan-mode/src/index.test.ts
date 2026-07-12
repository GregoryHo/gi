import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { writeSessionCurrentPlanPointer } from "./artifacts.ts";
import planModeExtension from "./index.ts";

test("exports a pi extension factory", () => {
  assert.equal(typeof planModeExtension, "function");
});

test("registers plan command that toggles write tools", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write", "custom_tool"] });

  planModeExtension(harness.pi as never);
  const planCommand = harness.commands.get("plan");
  assert.ok(planCommand);

  await planCommand.handler("", harness.ctx);
  assert.deepEqual(harness.activeTools, ["read", "bash", "grep", "find", "ls"]);
  assert.equal(harness.status["plan-mode"], "⏸ plan");

  await planCommand.handler("", harness.ctx);
  assert.deepEqual(harness.activeTools, ["read", "edit", "write", "custom_tool"]);
  assert.equal(harness.status["plan-mode"], undefined);
});

test("registers ctrl+alt+p shortcut with the same Plan Mode toggle behavior", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write", "custom_tool"] });

  planModeExtension(harness.pi as never);
  const shortcut = harness.shortcuts.get("ctrl+alt+p");
  assert.ok(shortcut);

  await shortcut.handler(harness.ctx);
  assert.deepEqual(harness.activeTools, ["read", "bash", "grep", "find", "ls"]);
  assert.equal(harness.status["plan-mode"], "⏸ plan");

  await shortcut.handler(harness.ctx);
  assert.deepEqual(harness.activeTools, ["read", "edit", "write", "custom_tool"]);
  assert.equal(harness.status["plan-mode"], undefined);
});

test("/plan routes consolidated current and on/off subcommands", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"], selectResults: ["Stay in plan mode"] });

  planModeExtension(harness.pi as never);
  assert.deepEqual(harness.commands.get("plan")?.getArgumentCompletions?.("cur")?.map((item) => item.value), ["current"]);
  await harness.commands.get("plan")?.handler("on", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Plan:\n1. Inspect code")] }, harness.ctx);
  await harness.commands.get("plan")?.handler("current", harness.ctx);
  assert.match(harness.notifications.at(-1)?.message ?? "", /1\. Inspect code/);

  await harness.commands.get("plan")?.handler("off", harness.ctx);
  assert.equal(harness.status["plan-mode"], undefined);
});

test("session_start honors --plan flag", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"], flagPlan: true });

  planModeExtension(harness.pi as never);
  await harness.event("session_start")({}, harness.ctx);

  assert.deepEqual(harness.activeTools, ["read", "bash", "grep", "find", "ls"]);
  assert.equal(harness.status["plan-mode"], "⏸ plan");
});

test("plan mode blocks unsafe bash and allows read-only bash", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"] });

  planModeExtension(harness.pi as never);
  const planCommand = harness.commands.get("plan");
  assert.ok(planCommand);
  await planCommand.handler("", harness.ctx);

  const toolCall = harness.event("tool_call");
  assert.deepEqual(await toolCall({ toolName: "bash", input: { command: "rm -rf tmp" } }), {
    block: true,
    reason: "Plan mode blocked this bash command because it is not on the read-only allowlist. Disable /plan to leave plan mode.",
  });
  assert.equal(await toolCall({ toolName: "bash", input: { command: "pwd" } }), undefined);
});

test("plan mode injects hidden planning context", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"] });

  planModeExtension(harness.pi as never);
  const planCommand = harness.commands.get("plan");
  assert.ok(planCommand);
  await planCommand.handler("", harness.ctx);

  const result = await harness.event("before_agent_start")({}, harness.ctx);
  assert.equal(result.message.customType, "plan-mode-context");
  assert.equal(result.message.display, false);
  assert.match(result.message.content, /\[PLAN MODE ACTIVE\]/);
  assert.doesNotMatch(result.message.content, /\[ACTIVE PLAN\]/);
});

test("plan mode injects active plan routing context after capture", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"], selectResults: ["Stay in plan mode"] });

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan")?.handler("", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Plan:\n1. Inspect code\n2. Write tests")] }, harness.ctx);

  const result = await harness.event("before_agent_start")({}, harness.ctx);

  assert.equal(result.message.customType, "plan-mode-context");
  assert.match(result.message.content, /\[PLAN MODE ACTIVE\]/);
  assert.match(result.message.content, /\[ACTIVE PLAN\]/);
  assert.match(result.message.content, /id: plan_/);
  assert.match(result.message.content, /status: draft/);
  assert.match(result.message.content, /progress: 0\/2/);
  assert.match(result.message.content, /distinct new objective/);
  assert.match(result.message.content, /Do not silently overwrite/);
  assert.match(result.message.content, /Do not silently switch/);
  assert.match(result.message.content, /Do not silently complete/);
  assert.match(result.message.content, /Do not silently abandon/);
  assert.match(result.message.content, /plan_record/);
  assert.match(result.message.content, /natural disposition/i);
  assert.doesNotMatch(result.message.content, /\/plan-new/);
  assert.match(result.message.content, /\/plan-history/);
  assert.match(result.message.content, /\/plan-switch <id>/);
});

test("context handler removes stale plan-mode context after mode is disabled", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"] });
  const keep = { role: "user", content: [{ type: "text", text: "hello" }] };

  planModeExtension(harness.pi as never);
  const result = await harness.event("context")({
    messages: [keep, { customType: "plan-mode-context", content: "[PLAN MODE ACTIVE]", display: false }],
  });

  assert.deepEqual(result, { messages: [keep] });
});


test("plan mode omits active routing context after plan completion", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"], selectResults: ["Stay in plan mode"] });

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan")?.handler("", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Plan:\n1. Inspect code")] }, harness.ctx);
  await harness.commands.get("plan-complete")?.handler("", harness.ctx);

  const current = await harness.tools.get("plan_get_current")?.execute("call_1", {}, undefined, undefined, harness.ctx);
  const context = await harness.event("before_agent_start")({}, harness.ctx);

  assert.equal(current.details.found, true);
  assert.equal(current.details.status, "completed");
  assert.doesNotMatch(context.message.content, /\[ACTIVE PLAN\]/);
});

test("agent_end captures a plan and stay choice preserves plan mode", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"], selectResults: ["Stay in plan mode"] });

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan")?.handler("", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Plan:\n1. Inspect code\n2. Write tests")] }, harness.ctx);

  assert.deepEqual(harness.activeTools, ["read", "bash", "grep", "find", "ls"]);
  assert.equal(harness.status["plan-mode"], "⏸ plan");
  assert.match(harness.notifications.at(-1)?.message ?? "", /1\. Inspect code/);
  assert.equal(harness.appendedEntries.at(-1)?.data.capturedPlan.steps.length, 2);
});

test("agent_end refine choice keeps plan mode and sends follow-up", async () => {
  const harness = await createHarness({
    activeTools: ["read", "edit", "write"],
    selectResults: ["Refine the plan"],
    editorResults: ["Please include tests."],
  });

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan")?.handler("", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Plan:\n1. Inspect code")] }, harness.ctx);

  assert.deepEqual(harness.activeTools, ["read", "bash", "grep", "find", "ls"]);
  assert.deepEqual(harness.sentUserMessages, [{ content: "Please include tests.", options: { deliverAs: "followUp" } }]);
});

test("agent_end approve choice exits plan mode without executing", async () => {
  const harness = await createHarness({
    activeTools: ["read", "edit", "write", "custom_tool"],
    selectResults: ["Approve plan and exit plan mode"],
  });

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan")?.handler("", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Plan:\n1. Inspect code")] }, harness.ctx);

  assert.deepEqual(harness.activeTools, ["read", "edit", "write", "custom_tool"]);
  assert.equal(harness.status["plan-mode"], undefined);
  assert.deepEqual(harness.sentUserMessages, []);
});

test("plan-current shows latest captured plan with artifact metadata", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"], selectResults: ["Stay in plan mode"] });

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan")?.handler("", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Plan:\n1. Inspect code")] }, harness.ctx);
  await harness.commands.get("plan-current")?.handler("", harness.ctx);

  const message = harness.notifications.at(-1)?.message ?? "";
  assert.match(message, /plan_/);
  assert.match(message, /status: draft/);
  assert.match(message, /session plan: 1/);
  assert.match(message, /1\. Inspect code/);
});

test("plan_get_current guidelines are read-only and extension-independent", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"] });

  planModeExtension(harness.pi as never);
  const tool = harness.tools.get("plan_get_current");
  const guidelines = tool?.promptGuidelines?.join("\n") ?? "";

  assert.match(tool?.promptSnippet ?? "", /without changing plan state/i);
  assert.match(guidelines, /does not execute/i);
  assert.doesNotMatch(guidelines, /goal_start|Goal Mode/i);
});

test("plan_control guidelines describe only Plan Mode control", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"] });

  planModeExtension(harness.pi as never);
  const tool = harness.tools.get("plan_control");
  const guidelines = tool?.promptGuidelines?.join("\n") ?? "";

  assert.match(guidelines, /enable or disable Plan Mode/i);
  assert.match(guidelines, /does not execute plans/i);
  assert.doesNotMatch(guidelines, /goal_start|Goal Mode/i);
});

test("plan_control enables and disables Plan Mode without starting execution", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"] });

  planModeExtension(harness.pi as never);
  const enableResult = await harness.tools.get("plan_control")?.execute("call_1", { action: "enable" }, undefined, undefined, harness.ctx);
  const disabledTools = harness.activeTools;
  const disableResult = await harness.tools.get("plan_control")?.execute("call_2", { action: "disable" }, undefined, undefined, harness.ctx);

  assert.equal(enableResult.details.accepted, true);
  assert.equal(enableResult.details.enabled, true);
  assert.equal(harness.status["plan-mode"], undefined);
  assert.equal(disableResult.details.accepted, true);
  assert.equal(disableResult.details.enabled, false);
  assert.deepEqual(disabledTools.includes("edit"), false);
  assert.deepEqual(harness.activeTools, ["read", "edit", "write"]);
  assert.deepEqual(harness.sentUserMessages, []);
});

test("plan_control disable removes Plan Mode bash gate without mutating plan artifact", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"], selectResults: ["Stay in plan mode"] });

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan")?.handler("", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Plan:\n1. Inspect code")] }, harness.ctx);
  const before = await readFile(join(harness.artifactRoot, "current.json"), "utf8");

  await harness.tools.get("plan_control")?.execute("call_1", { action: "disable" }, undefined, undefined, harness.ctx);
  const bashAfterDisable = await harness.event("tool_call")({ toolName: "bash", input: { command: "npm test -w @gregho/pi-extension-goal-mode" } });
  const after = await readFile(join(harness.artifactRoot, "current.json"), "utf8");

  assert.equal(bashAfterDisable, undefined);
  assert.equal(after, before);
  assert.deepEqual(harness.sentUserMessages, []);
});

test("plan_get_current returns found false without a current plan", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"] });

  planModeExtension(harness.pi as never);
  const result = await harness.tools.get("plan_get_current")?.execute("call_1", {}, undefined, undefined, harness.ctx);

  assert.equal(result.details.found, false);
  assert.match(result.content[0].text, /No current plan/i);
});

test("plan_get_current does not leak another session's current plan", async () => {
	const artifactRoot = await mkdtemp(join(tmpdir(), "plan-mode-shared-session-test-"));
	const previousArtifactRoot = process.env.PI_PLAN_MODE_ARTIFACT_ROOT;
	try {
		const sessionA = await createHarness({
			activeTools: ["read", "edit", "write"],
			artifactRoot,
			sessionFile: "/sessions/a.jsonl",
		});
		planModeExtension(sessionA.pi as never);
		await sessionA.tools.get("plan_record")?.execute("call_1", {
			intent: "new",
			title: "Session A plan",
			steps: [{ step: 1, text: "Only session A should see this" }],
		}, undefined, undefined, sessionA.ctx);

		const sessionB = await createHarness({
			activeTools: ["read", "edit", "write"],
			artifactRoot,
			sessionFile: "/sessions/b.jsonl",
		});
		planModeExtension(sessionB.pi as never);
		await sessionB.event("session_start")({}, sessionB.ctx);
		const current = await sessionB.tools.get("plan_get_current")?.execute("call_2", {}, undefined, undefined, sessionB.ctx);
		await sessionB.commands.get("plan-history")?.handler("", sessionB.ctx);

		assert.equal(current.details.found, false);
		assert.match(sessionB.notifications.at(-1)?.message ?? "", /Session A plan/);
	} finally {
		if (previousArtifactRoot === undefined) delete process.env.PI_PLAN_MODE_ARTIFACT_ROOT;
		else process.env.PI_PLAN_MODE_ARTIFACT_ROOT = previousArtifactRoot;
		await rm(artifactRoot, { recursive: true, force: true });
	}
});

test("session_start restores current plan from the session pointer when custom state is missing", async () => {
	const artifactRoot = await mkdtemp(join(tmpdir(), "plan-mode-session-restore-test-"));
	const previousArtifactRoot = process.env.PI_PLAN_MODE_ARTIFACT_ROOT;
	try {
		const firstRuntime = await createHarness({
			activeTools: ["read", "edit", "write"],
			artifactRoot,
			sessionFile: "/sessions/a.jsonl",
		});
		planModeExtension(firstRuntime.pi as never);
		await firstRuntime.tools.get("plan_record")?.execute("call_1", {
			intent: "new",
			title: "Recoverable session plan",
			steps: [{ step: 1, text: "Restore from session pointer" }],
		}, undefined, undefined, firstRuntime.ctx);

		const restoredRuntime = await createHarness({
			activeTools: ["read", "edit", "write"],
			artifactRoot,
			sessionFile: "/sessions/a.jsonl",
			entries: [],
		});
		planModeExtension(restoredRuntime.pi as never);
		await restoredRuntime.event("session_start")({}, restoredRuntime.ctx);
		await restoredRuntime.commands.get("plan-current")?.handler("", restoredRuntime.ctx);
		const toolCurrent = await restoredRuntime.tools.get("plan_get_current")?.execute("call_2", {}, undefined, undefined, restoredRuntime.ctx);

		assert.match(restoredRuntime.notifications.at(-1)?.message ?? "", /Recoverable session plan/);
		assert.equal(toolCurrent.details.found, true);
		assert.equal(toolCurrent.details.title, "Recoverable session plan");
	} finally {
		if (previousArtifactRoot === undefined) delete process.env.PI_PLAN_MODE_ARTIFACT_ROOT;
		else process.env.PI_PLAN_MODE_ARTIFACT_ROOT = previousArtifactRoot;
		await rm(artifactRoot, { recursive: true, force: true });
	}
});

test("session_start safely ignores a session pointer whose artifact is missing", async () => {
	const artifactRoot = await mkdtemp(join(tmpdir(), "plan-mode-missing-artifact-test-"));
	const previousArtifactRoot = process.env.PI_PLAN_MODE_ARTIFACT_ROOT;
	try {
		await writeSessionCurrentPlanPointer(artifactRoot, "/sessions/a.jsonl", { activePlanId: "missing_plan" });
		const harness = await createHarness({
			activeTools: ["read", "edit", "write"],
			artifactRoot,
			sessionFile: "/sessions/a.jsonl",
		});
		planModeExtension(harness.pi as never);
		await harness.event("session_start")({}, harness.ctx);
		await harness.commands.get("plan-current")?.handler("", harness.ctx);
		const toolCurrent = await harness.tools.get("plan_get_current")?.execute("call_1", {}, undefined, undefined, harness.ctx);

		assert.match(harness.notifications.at(-1)?.message ?? "", /No captured plan/i);
		assert.equal(toolCurrent.details.found, false);
	} finally {
		if (previousArtifactRoot === undefined) delete process.env.PI_PLAN_MODE_ARTIFACT_ROOT;
		else process.env.PI_PLAN_MODE_ARTIFACT_ROOT = previousArtifactRoot;
		await rm(artifactRoot, { recursive: true, force: true });
	}
});

test("ephemeral sessions keep current plan state in memory", async () => {
	const harness = await createHarness({ activeTools: ["read", "edit", "write"], ephemeral: true });
	planModeExtension(harness.pi as never);
	await harness.tools.get("plan_record")?.execute("call_1", {
		intent: "new",
		title: "Ephemeral plan",
		steps: [{ step: 1, text: "Stay in memory" }],
	}, undefined, undefined, harness.ctx);
	await harness.commands.get("plan-current")?.handler("", harness.ctx);
	const toolCurrent = await harness.tools.get("plan_get_current")?.execute("call_2", {}, undefined, undefined, harness.ctx);

	assert.match(harness.notifications.at(-1)?.message ?? "", /Ephemeral plan/);
	assert.equal(toolCurrent.details.title, "Ephemeral plan");
	assert.equal(harness.ctx.sessionManager.getSessionFile(), undefined);
});

test("terminal selected plans restore consistently within their session", async () => {
	const artifactRoot = await mkdtemp(join(tmpdir(), "plan-mode-terminal-restore-test-"));
	const previousArtifactRoot = process.env.PI_PLAN_MODE_ARTIFACT_ROOT;
	try {
		const firstRuntime = await createHarness({
			activeTools: ["read", "edit", "write"],
			artifactRoot,
			sessionFile: "/sessions/a.jsonl",
		});
		planModeExtension(firstRuntime.pi as never);
		await firstRuntime.tools.get("plan_record")?.execute("call_1", {
			intent: "new",
			title: "Completed session plan",
			steps: [{ step: 1, text: "Finish safely" }],
		}, undefined, undefined, firstRuntime.ctx);
		await firstRuntime.commands.get("plan-complete")?.handler("", firstRuntime.ctx);

		const restoredRuntime = await createHarness({
			activeTools: ["read", "edit", "write"],
			artifactRoot,
			sessionFile: "/sessions/a.jsonl",
			entries: [],
		});
		planModeExtension(restoredRuntime.pi as never);
		await restoredRuntime.event("session_start")({}, restoredRuntime.ctx);
		await restoredRuntime.commands.get("plan-current")?.handler("", restoredRuntime.ctx);
		const toolCurrent = await restoredRuntime.tools.get("plan_get_current")?.execute("call_2", {}, undefined, undefined, restoredRuntime.ctx);

		assert.match(restoredRuntime.notifications.at(-1)?.message ?? "", /status: completed/);
		assert.equal(toolCurrent.details.status, "completed");
	} finally {
		if (previousArtifactRoot === undefined) delete process.env.PI_PLAN_MODE_ARTIFACT_ROOT;
		else process.env.PI_PLAN_MODE_ARTIFACT_ROOT = previousArtifactRoot;
		await rm(artifactRoot, { recursive: true, force: true });
	}
});

test("plan_get_current returns compact current artifact data without internals", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"], selectResults: ["Stay in plan mode"] });

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan")?.handler("", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Plan:\n1. Inspect code\n2. Write tests")] }, harness.ctx);
  const result = await harness.tools.get("plan_get_current")?.execute("call_1", {}, undefined, undefined, harness.ctx);

  assert.equal(result.details.found, true);
  assert.match(result.details.planId, /^plan_/);
  assert.equal(result.details.title, "Inspect code");
  assert.equal(result.details.status, "draft");
  assert.equal(result.details.cwd, "/repo");
  assert.deepEqual(result.details.steps, [
    { step: 1, text: "Inspect code" },
    { step: 2, text: "Write tests" },
  ]);
  assert.equal("artifactPath" in result.details, false);
  assert.equal("session" in result.details, false);
});

test("plan_get_current does not mutate current artifact", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"], selectResults: ["Stay in plan mode"] });

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan")?.handler("", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Plan:\n1. Inspect code")] }, harness.ctx);
  const before = await readFile(join(harness.artifactRoot, "current.json"), "utf8");

  await harness.tools.get("plan_get_current")?.execute("call_1", {}, undefined, undefined, harness.ctx);
  const after = await readFile(join(harness.artifactRoot, "current.json"), "utf8");

	assert.equal(after, before);
});

test("plan_record creates a new current plan from structured steps", async () => {
	const harness = await createHarness({ activeTools: ["read", "edit", "write"] });

	planModeExtension(harness.pi as never);
	const result = await harness.tools.get("plan_record")?.execute("call_1", {
		intent: "new",
		title: "Natural planning flow",
		steps: [
			{ step: 1, text: "Add a plan tool" },
			{ step: 2, text: "Verify natural routing" },
		],
	}, undefined, undefined, harness.ctx);
	const current = JSON.parse(await readFile(join(harness.artifactRoot, "current.json"), "utf8"));

	assert.equal(result.details.accepted, true);
	assert.equal(result.details.title, "Natural planning flow");
	assert.equal(result.details.status, "draft");
	assert.match(current.activePlanId, /^plan_/);
	assert.equal(harness.status["plan-mode"], "⏸ plan");
});

test("plan_record rejects new objectives over active plans without disposition", async () => {
	const harness = await createHarness({ activeTools: ["read", "edit", "write"] });

	planModeExtension(harness.pi as never);
	await harness.tools.get("plan_record")?.execute("call_1", {
		intent: "new",
		title: "First plan",
		steps: [{ step: 1, text: "Keep me" }],
	}, undefined, undefined, harness.ctx);
	const before = JSON.parse(await readFile(join(harness.artifactRoot, "current.json"), "utf8")).activePlanId;

	const result = await harness.tools.get("plan_record")?.execute("call_2", {
		intent: "new",
		title: "Second plan",
		steps: [{ step: 1, text: "Replace me" }],
	}, undefined, undefined, harness.ctx);
	const after = JSON.parse(await readFile(join(harness.artifactRoot, "current.json"), "utf8")).activePlanId;

	assert.equal(result.details.accepted, false);
	assert.equal(result.details.reason, "needs_disposition");
	assert.equal(after, before);
});

test("plan_record pauses an active plan before recording a new objective", async () => {
	const harness = await createHarness({ activeTools: ["read", "edit", "write"] });

	planModeExtension(harness.pi as never);
	await harness.tools.get("plan_record")?.execute("call_1", {
		intent: "new",
		title: "First plan",
		steps: [{ step: 1, text: "Keep me" }],
	}, undefined, undefined, harness.ctx);

	const result = await harness.tools.get("plan_record")?.execute("call_2", {
		intent: "new",
		activePlanDisposition: "pause",
		title: "Second plan",
		steps: [{ step: 1, text: "Record naturally" }],
	}, undefined, undefined, harness.ctx);
	const index = JSON.parse(await readFile(join(harness.artifactRoot, "index.json"), "utf8"));

	assert.equal(result.details.accepted, true);
	assert.equal(result.details.title, "Second plan");
	assert.equal(index.plans[0].status, "paused");
	assert.equal(index.plans[1].status, "draft");
});

test("plan_record refines the current plan while preserving its id", async () => {
	const harness = await createHarness({ activeTools: ["read", "edit", "write"] });

	planModeExtension(harness.pi as never);
	await harness.tools.get("plan_record")?.execute("call_1", {
		intent: "new",
		title: "Original plan",
		steps: [{ step: 1, text: "Original step" }],
	}, undefined, undefined, harness.ctx);
	const before = JSON.parse(await readFile(join(harness.artifactRoot, "current.json"), "utf8")).activePlanId;

	const result = await harness.tools.get("plan_record")?.execute("call_2", {
		intent: "refine_current",
		title: "Refined plan",
		steps: [{ step: 1, text: "Refined step" }],
	}, undefined, undefined, harness.ctx);
	const after = JSON.parse(await readFile(join(harness.artifactRoot, "current.json"), "utf8")).activePlanId;

	assert.equal(result.details.accepted, true);
	assert.equal(result.details.planId, before);
  assert.equal(after, before);
  assert.deepEqual(result.details.steps, [{ step: 1, text: "Refined step" }]);
});

test("plan-execute without a captured plan reports no plan", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"] });

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan-execute")?.handler("", harness.ctx);

  assert.deepEqual(harness.activeTools, ["read", "edit", "write"]);
  assert.equal(harness.notifications.at(-1)?.message, "No captured plan to execute.");
  assert.deepEqual(harness.sentUserMessages, []);
});

test("execute choice exits plan mode and sends execution follow-up", async () => {
  const harness = await createHarness({
    activeTools: ["read", "edit", "write", "custom_tool"],
    selectResults: ["Execute the plan"],
  });

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan")?.handler("", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Plan:\n1. Inspect code\n2. Write tests")] }, harness.ctx);

  assert.deepEqual(harness.activeTools, ["read", "edit", "write", "custom_tool"]);
  assert.equal(harness.status["plan-mode"], undefined);
  assert.equal(harness.status["plan-progress"], "📋 0/2");
  assert.match(harness.sentUserMessages.at(-1)?.content ?? "", /Start with: Inspect code/);
  assert.deepEqual(harness.sentUserMessages.at(-1)?.options, { deliverAs: "followUp" });
});

test("execution widget limits and truncates long plans for narrow terminals", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"], selectResults: ["Execute the plan"] });
  const steps = Array.from({ length: 8 }, (_, index) => `${index + 1}. ${"Long plan step ".repeat(10)}${index + 1}`).join("\n");

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan")?.handler("", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage(`Plan:\n${steps}`)] }, harness.ctx);

  const lines = harness.widgets["plan-progress"] ?? [];
  assert.equal(lines.length, 6);
  assert.ok(lines.every((line) => line.length <= 76));
  assert.match(lines.at(-1) ?? "", /3 more/);
});

test("plan-execute command starts execution for captured plan", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"], selectResults: ["Stay in plan mode"] });

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan")?.handler("", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Plan:\n1. Inspect code")] }, harness.ctx);
  await harness.commands.get("plan-execute")?.handler("", harness.ctx);

  assert.deepEqual(harness.activeTools, ["read", "edit", "write"]);
  assert.equal(harness.status["plan-progress"], "📋 0/1");
  assert.match(harness.sentUserMessages.at(-1)?.content ?? "", /Execute the approved plan/);
});

test("execution mode injects remaining-step context", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"], selectResults: ["Execute the plan"] });

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan")?.handler("", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Plan:\n1. Inspect code")] }, harness.ctx);

  const result = await harness.event("before_agent_start")({}, harness.ctx);
  assert.equal(result.message.customType, "plan-execution-context");
  assert.match(result.message.content, /\[DONE:n\]/);
  assert.match(result.message.content, /1\. Inspect code/);
  assert.match(result.message.content, /\[ACTIVE PLAN\]/);
  assert.match(result.message.content, /progress: 0\/1/);
  assert.match(result.message.content, /Do not silently overwrite/);
});

test("done markers update progress and plan-current completion display", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"], selectResults: ["Execute the plan"] });

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan")?.handler("", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Plan:\n1. Inspect code\n2. Write tests")] }, harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Completed first step. [DONE:1] [DONE:99]")] }, harness.ctx);
  await harness.commands.get("plan-current")?.handler("", harness.ctx);

  assert.equal(harness.status["plan-progress"], "📋 1/2");
  assert.match(harness.notifications.at(-1)?.message ?? "", /1\. ☑ Inspect code/);
  assert.match(harness.notifications.at(-1)?.message ?? "", /2\. ☐ Write tests/);
});

test("done markers are collected from all assistant messages in an agent_end batch", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"], selectResults: ["Execute the plan"] });

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan")?.handler("", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Plan:\n1. Inspect code\n2. Write tests\n3. Verify")] }, harness.ctx);
  await harness.event("agent_end")(
    {
      messages: [
        assistantMessage("Finished implementation. [DONE:1] [DONE:2]"),
        assistantMessage("Running final checks now."),
      ],
    },
    harness.ctx,
  );

  assert.equal(harness.status["plan-progress"], "📋 2/3");
});

test("all done markers end execution state", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"], selectResults: ["Execute the plan"] });

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan")?.handler("", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Plan:\n1. Inspect code")] }, harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Done. [DONE:1]")] }, harness.ctx);

  assert.equal(harness.status["plan-progress"], undefined);
  assert.equal(harness.widgets["plan-progress"], undefined);
  assert.match(harness.notifications.at(-1)?.message ?? "", /Plan execution markers complete/);
});

test("capturing a plan writes current pointer and artifact outside repo", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"], selectResults: ["Stay in plan mode"] });

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan")?.handler("", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Plan:\n1. Inspect code")] }, harness.ctx);

  const pointer = JSON.parse(await readFile(join(harness.artifactRoot, "current.json"), "utf8"));
  assert.deepEqual(Object.keys(pointer), ["activePlanId"]);
  assert.match(pointer.activePlanId, /^plan_/);

  const index = JSON.parse(await readFile(join(harness.artifactRoot, "index.json"), "utf8"));
  assert.equal(index.plans.length, 1);
  assert.equal(index.plans[0].cwd, harness.ctx.cwd);
  assert.equal(index.plans[0].sessionFile, harness.sessionFile);
  assert.match(index.plans[0].artifactPath, /^plans\/\d{4}-\d{2}\/plan_/);
});

test("plan-history and plan-history --session list expected plans", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"], selectResults: ["Stay in plan mode"] });

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan")?.handler("", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Plan:\n1. Inspect code")] }, harness.ctx);
  await harness.commands.get("plan-history")?.handler("", harness.ctx);
  assert.match(harness.notifications.at(-1)?.message ?? "", /Inspect code/);

  await harness.commands.get("plan-history")?.handler("--session", harness.ctx);
  assert.match(harness.notifications.at(-1)?.message ?? "", /session plan 1/);
});

test("plan-switch restores an existing artifact", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"], selectResults: ["Stay in plan mode"] });

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan")?.handler("", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Plan:\n1. Inspect code")] }, harness.ctx);
  const planId = JSON.parse(await readFile(join(harness.artifactRoot, "current.json"), "utf8")).activePlanId;

  await harness.commands.get("plan-switch")?.handler(planId, harness.ctx);
  await harness.commands.get("plan-current")?.handler("", harness.ctx);

  assert.match(harness.notifications.at(-1)?.message ?? "", new RegExp(planId));
});

test("plan-complete and plan-abandon update status and recap", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"], selectResults: ["Stay in plan mode"] });

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan")?.handler("", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Plan:\n1. Inspect code")] }, harness.ctx);
  await harness.commands.get("plan-complete")?.handler("", harness.ctx);
  assert.match(harness.notifications.at(-1)?.message ?? "", /completed/);

  const index = JSON.parse(await readFile(join(harness.artifactRoot, "index.json"), "utf8"));
  assert.equal(index.plans[0].status, "completed");
  const artifact = JSON.parse(await readFile(join(harness.artifactRoot, index.plans[0].artifactPath), "utf8"));
  assert.equal(artifact.recap.completedSteps, 0);

  await harness.commands.get("plan-abandon")?.handler("", harness.ctx);
  assert.match(harness.notifications.at(-1)?.message ?? "", /abandoned/);
});

test("plan-complete migrates a session-local captured plan without activePlanId", async () => {
  const harness = await createHarness({
    activeTools: ["read", "edit", "write"],
    entries: [
      {
        type: "custom",
        customType: "plan-mode",
        data: {
          enabled: false,
          capturedPlan: { steps: [{ step: 1, text: "Legacy current plan" }] },
          executing: false,
        },
      },
    ],
  });

  planModeExtension(harness.pi as never);
  await harness.event("session_start")({}, harness.ctx);
  await harness.commands.get("plan-current")?.handler("", harness.ctx);
  assert.match(harness.notifications.at(-1)?.message ?? "", /Legacy current plan/);

  await harness.commands.get("plan-complete")?.handler("", harness.ctx);

  assert.match(harness.notifications.at(-1)?.message ?? "", /completed/);
  const index = JSON.parse(await readFile(join(harness.artifactRoot, "index.json"), "utf8"));
  assert.equal(index.plans[0].status, "completed");
  assert.match(index.plans[0].summary, /Legacy current plan/);
});

test("plan-new requires disposition before replacing active plan", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"], selectResults: ["Stay in plan mode", "Cancel"] });

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan")?.handler("", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Plan:\n1. Inspect code")] }, harness.ctx);
  const before = JSON.parse(await readFile(join(harness.artifactRoot, "current.json"), "utf8")).activePlanId;

  await harness.commands.get("plan-new")?.handler("", harness.ctx);

  const after = JSON.parse(await readFile(join(harness.artifactRoot, "current.json"), "utf8")).activePlanId;
  assert.equal(after, before);
  assert.match(harness.notifications.at(-1)?.message ?? "", /cancelled/i);
});

test("plan-new can pause the current plan before starting a new plan", async () => {
  const harness = await createHarness({ activeTools: ["read", "edit", "write"], selectResults: ["Stay in plan mode", "Pause current plan"] });

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan")?.handler("", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Plan:\n1. Inspect code")] }, harness.ctx);

  await harness.commands.get("plan-new")?.handler("", harness.ctx);

  const index = JSON.parse(await readFile(join(harness.artifactRoot, "index.json"), "utf8"));
  assert.equal(index.plans[0].status, "paused");
  assert.deepEqual(JSON.parse(await readFile(join(harness.artifactRoot, "current.json"), "utf8")), {});
  assert.match(harness.notifications.at(-1)?.message ?? "", /Ready to capture a new plan/);
});

function assistantMessage(text: string): unknown {
  return { role: "assistant", content: [{ type: "text", text }] };
}

interface FakeCommand {
  handler: (args: string, ctx: FakeContext) => Promise<void> | void;
  getArgumentCompletions?: (prefix: string) => Array<{ value: string }> | null;
}

interface FakeShortcut {
  handler: (ctx: FakeContext) => Promise<void> | void;
}

interface FakeTool {
  promptSnippet?: string;
  promptGuidelines?: string[];
  execute: (toolCallId: string, params: any, signal?: AbortSignal, onUpdate?: unknown, ctx?: FakeContext) => Promise<any> | any;
}

interface FakeContext {
  cwd: string;
  hasUI: boolean;
  ui: {
    theme: { fg: (_color: string, text: string) => string };
    setStatus: (key: string, value: string | undefined) => void;
    setWidget: (key: string, value: string[] | undefined) => void;
    notify: (message: string, level?: string) => void;
    select: (_title: string, _options: string[]) => Promise<string | undefined>;
    editor: (_title: string, _initial: string) => Promise<string | undefined>;
  };
  sessionManager: { getEntries: () => unknown[]; getSessionFile: () => string | undefined };
}

interface HarnessOptions {
  activeTools: string[];
  flagPlan?: boolean;
  entries?: unknown[];
  hasUI?: boolean;
  selectResults?: Array<string | undefined>;
  editorResults?: Array<string | undefined>;
  cwd?: string;
  sessionFile?: string;
	ephemeral?: boolean;
	artifactRoot?: string;
}

async function createHarness(options: HarnessOptions): Promise<{
  pi: object;
  ctx: FakeContext;
  commands: Map<string, FakeCommand>;
  shortcuts: Map<string, FakeShortcut>;
  tools: Map<string, FakeTool>;
  status: Record<string, string | undefined>;
  notifications: Array<{ message: string; level?: string }>;
  widgets: Record<string, string[] | undefined>;
  sentUserMessages: Array<{ content: string; options?: unknown }>;
  appendedEntries: Array<{ customType: string; data: any }>;
  artifactRoot: string;
  sessionFile: string | undefined;
  get activeTools(): string[];
  event: (name: string) => (...args: any[]) => Promise<any> | any;
}> {
  const commands = new Map<string, FakeCommand>();
  const shortcuts = new Map<string, FakeShortcut>();
  const tools = new Map<string, FakeTool>();
  const events = new Map<string, Array<(...args: any[]) => Promise<any> | any>>();
  const status: Record<string, string | undefined> = {};
  const notifications: Array<{ message: string; level?: string }> = [];
  const widgets: Record<string, string[] | undefined> = {};
  const sentUserMessages: Array<{ content: string; options?: unknown }> = [];
  const appendedEntries: Array<{ customType: string; data: any }> = [];
  const selectResults = [...(options.selectResults ?? [])];
  const editorResults = [...(options.editorResults ?? [])];
  const artifactRoot = options.artifactRoot ?? await mkdtemp(join(tmpdir(), "plan-mode-runtime-test-"));
  const previousArtifactRoot = process.env.PI_PLAN_MODE_ARTIFACT_ROOT;
  process.env.PI_PLAN_MODE_ARTIFACT_ROOT = artifactRoot;
	if (!options.artifactRoot) {
		test.after(async () => {
			if (previousArtifactRoot === undefined) delete process.env.PI_PLAN_MODE_ARTIFACT_ROOT;
			else process.env.PI_PLAN_MODE_ARTIFACT_ROOT = previousArtifactRoot;
			await rm(artifactRoot, { recursive: true, force: true });
		});
	}
  let activeTools = options.activeTools;
  const sessionFile = options.ephemeral ? undefined : options.sessionFile ?? "/sessions/current.jsonl";

  const pi = {
    registerFlag() {},
    registerCommand(name: string, command: FakeCommand) {
      commands.set(name, command);
    },
	registerShortcut(shortcut: string, definition: FakeShortcut) {
	  shortcuts.set(shortcut, definition);
	},
    registerTool(tool: FakeTool & { name: string }) {
      tools.set(tool.name, tool);
    },
    on(name: string, handler: (...args: any[]) => Promise<any> | any) {
      events.set(name, [...(events.get(name) ?? []), handler]);
    },
    appendEntry(customType: string, data: any) {
      appendedEntries.push({ customType, data });
    },
    sendUserMessage(content: string, options?: unknown) {
      sentUserMessages.push({ content, options });
    },
    getFlag(name: string) {
      return name === "plan" ? options.flagPlan === true : false;
    },
    getActiveTools() {
      return activeTools;
    },
    setActiveTools(next: string[]) {
      activeTools = next;
    },
  };

  const ctx: FakeContext = {
    cwd: options.cwd ?? "/repo",
    hasUI: options.hasUI ?? true,
    ui: {
      theme: { fg: (_color: string, text: string) => text },
      setStatus(key: string, value: string | undefined) {
        status[key] = value;
      },
      setWidget(key: string, value: string[] | undefined) {
        widgets[key] = value;
      },
      notify(message: string, level?: string) {
        notifications.push({ message, level });
      },
      async select() {
        return selectResults.shift();
      },
      async editor() {
        return editorResults.shift();
      },
    },
    sessionManager: { getEntries: () => options.entries ?? [], getSessionFile: () => sessionFile },
  };

  return {
    pi,
    ctx,
    commands,
	shortcuts,
    tools,
    status,
    notifications,
    widgets,
    sentUserMessages,
    appendedEntries,
    artifactRoot,
    sessionFile,
    get activeTools() {
      return activeTools;
    },
    event(name: string) {
      const handler = events.get(name)?.[0];
      assert.ok(handler, `missing event handler: ${name}`);
      return handler;
    },
  };
}
