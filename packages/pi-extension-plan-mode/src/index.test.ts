import assert from "node:assert/strict";
import test from "node:test";

import planModeExtension from "./index.ts";

test("exports a pi extension factory", () => {
  assert.equal(typeof planModeExtension, "function");
});

test("registers plan command that toggles write tools", async () => {
  const harness = createHarness({ activeTools: ["read", "edit", "write", "custom_tool"] });

  planModeExtension(harness.pi as never);
  const planCommand = harness.commands.get("plan");
  assert.ok(planCommand);

  await planCommand.handler("", harness.ctx);
  assert.deepEqual(harness.activeTools, ["read", "custom_tool", "bash", "grep", "find", "ls"]);
  assert.equal(harness.status["plan-mode"], "⏸ plan");

  await planCommand.handler("", harness.ctx);
  assert.deepEqual(harness.activeTools, ["read", "edit", "write", "custom_tool"]);
  assert.equal(harness.status["plan-mode"], undefined);
});

test("session_start honors --plan flag", async () => {
  const harness = createHarness({ activeTools: ["read", "edit", "write"], flagPlan: true });

  planModeExtension(harness.pi as never);
  await harness.event("session_start")({}, harness.ctx);

  assert.deepEqual(harness.activeTools, ["read", "bash", "grep", "find", "ls"]);
  assert.equal(harness.status["plan-mode"], "⏸ plan");
});

test("plan mode blocks unsafe bash and allows read-only bash", async () => {
  const harness = createHarness({ activeTools: ["read", "edit", "write"] });

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
  const harness = createHarness({ activeTools: ["read", "edit", "write"] });

  planModeExtension(harness.pi as never);
  const planCommand = harness.commands.get("plan");
  assert.ok(planCommand);
  await planCommand.handler("", harness.ctx);

  const result = await harness.event("before_agent_start")({}, harness.ctx);
  assert.equal(result.message.customType, "plan-mode-context");
  assert.equal(result.message.display, false);
  assert.match(result.message.content, /\[PLAN MODE ACTIVE\]/);
});

test("context handler removes stale plan-mode context after mode is disabled", async () => {
  const harness = createHarness({ activeTools: ["read", "edit", "write"] });
  const keep = { role: "user", content: [{ type: "text", text: "hello" }] };

  planModeExtension(harness.pi as never);
  const result = await harness.event("context")({
    messages: [keep, { customType: "plan-mode-context", content: "[PLAN MODE ACTIVE]", display: false }],
  });

  assert.deepEqual(result, { messages: [keep] });
});

test("agent_end captures a plan and stay choice preserves plan mode", async () => {
  const harness = createHarness({ activeTools: ["read", "edit", "write"], selectResults: ["Stay in plan mode"] });

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan")?.handler("", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Plan:\n1. Inspect code\n2. Write tests")] }, harness.ctx);

  assert.deepEqual(harness.activeTools, ["read", "bash", "grep", "find", "ls"]);
  assert.equal(harness.status["plan-mode"], "⏸ plan");
  assert.match(harness.notifications.at(-1)?.message ?? "", /1\. Inspect code/);
  assert.equal(harness.appendedEntries.at(-1)?.data.capturedPlan.steps.length, 2);
});

test("agent_end refine choice keeps plan mode and sends follow-up", async () => {
  const harness = createHarness({
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
  const harness = createHarness({
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

test("plan-current shows latest captured plan", async () => {
  const harness = createHarness({ activeTools: ["read", "edit", "write"], selectResults: ["Stay in plan mode"] });

  planModeExtension(harness.pi as never);
  await harness.commands.get("plan")?.handler("", harness.ctx);
  await harness.event("agent_end")({ messages: [assistantMessage("Plan:\n1. Inspect code")] }, harness.ctx);
  await harness.commands.get("plan-current")?.handler("", harness.ctx);

  assert.match(harness.notifications.at(-1)?.message ?? "", /1\. Inspect code/);
});

function assistantMessage(text: string): unknown {
  return { role: "assistant", content: [{ type: "text", text }] };
}

interface FakeCommand {
  handler: (args: string, ctx: FakeContext) => Promise<void> | void;
}

interface FakeContext {
  hasUI: boolean;
  ui: {
    theme: { fg: (_color: string, text: string) => string };
    setStatus: (key: string, value: string | undefined) => void;
    notify: (message: string, level?: string) => void;
    select: (_title: string, _options: string[]) => Promise<string | undefined>;
    editor: (_title: string, _initial: string) => Promise<string | undefined>;
  };
  sessionManager: { getEntries: () => unknown[] };
}

interface HarnessOptions {
  activeTools: string[];
  flagPlan?: boolean;
  entries?: unknown[];
  hasUI?: boolean;
  selectResults?: Array<string | undefined>;
  editorResults?: Array<string | undefined>;
}

function createHarness(options: HarnessOptions): {
  pi: object;
  ctx: FakeContext;
  commands: Map<string, FakeCommand>;
  status: Record<string, string | undefined>;
  notifications: Array<{ message: string; level?: string }>;
  sentUserMessages: Array<{ content: string; options?: unknown }>;
  appendedEntries: Array<{ customType: string; data: any }>;
  get activeTools(): string[];
  event: (name: string) => (...args: any[]) => Promise<any> | any;
} {
  const commands = new Map<string, FakeCommand>();
  const events = new Map<string, Array<(...args: any[]) => Promise<any> | any>>();
  const status: Record<string, string | undefined> = {};
  const notifications: Array<{ message: string; level?: string }> = [];
  const sentUserMessages: Array<{ content: string; options?: unknown }> = [];
  const appendedEntries: Array<{ customType: string; data: any }> = [];
  const selectResults = [...(options.selectResults ?? [])];
  const editorResults = [...(options.editorResults ?? [])];
  let activeTools = options.activeTools;

  const pi = {
    registerFlag() {},
    registerCommand(name: string, command: FakeCommand) {
      commands.set(name, command);
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
    hasUI: options.hasUI ?? true,
    ui: {
      theme: { fg: (_color: string, text: string) => text },
      setStatus(key: string, value: string | undefined) {
        status[key] = value;
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
    sessionManager: { getEntries: () => options.entries ?? [] },
  };

  return {
    pi,
    ctx,
    commands,
    status,
    notifications,
    sentUserMessages,
    appendedEntries,
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
