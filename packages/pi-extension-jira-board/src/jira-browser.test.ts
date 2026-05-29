import assert from "node:assert/strict";
import test from "node:test";

import type { CompactJiraIssue } from "./issue-mapper.ts";
import type { JiraProject } from "./jira-types.ts";
import type { JiraProjectPage } from "./jira-query.ts";
import {
  clearJiraRuntimeContext,
  getActiveJiraProjectKey,
  getJiraCurrentContext,
  setActiveJiraBoard,
} from "./jira-context.ts";
import {
  createIssuePickerComponent,
  createPagedPickerComponent,
  defaultProjectIssueJql,
  formatIssueCardsWidget,
  formatProjectCardWidget,
  registerJiraBrowserCommands,
  resolveIssueBrowserJql,
} from "./jira-browser.ts";

const project: JiraProject = { id: "1", key: "CHATAPP", name: "聊天APP" };
const issue: CompactJiraIssue = {
  key: "CHATAPP-5410",
  url: "https://jira.example.com/browse/CHATAPP-5410",
  summary: "[iOS] 既有功能 API 重構為 core module 模式_Phase 2",
  status: "In Progress",
  statusCategory: "indeterminate",
  issueType: "Task",
  priority: "Medium",
  assignee: "anton_liu",
  labels: [],
  descriptionTruncated: false,
};

const projectPage: JiraProjectPage = {
  startAt: 0,
  maxResults: 10,
  total: 1,
  returned: 1,
  isLast: true,
  projects: [project],
};

test("defaultProjectIssueJql builds the safe open-issue project query", () => {
  assert.equal(
    defaultProjectIssueJql("CHATAPP"),
    "project = CHATAPP AND statusCategory != Done ORDER BY updated DESC",
  );
});

test("resolveIssueBrowserJql prefers raw JQL then project shorthand then active/configured project", () => {
  clearJiraRuntimeContext();
  assert.equal(resolveIssueBrowserJql("--jql project = IOS", "ACTIVE", "PROJ"), "project = IOS");
  assert.equal(resolveIssueBrowserJql("CHATAPP", "ACTIVE", "PROJ"), defaultProjectIssueJql("CHATAPP"));
  assert.equal(resolveIssueBrowserJql("", "ACTIVE", "PROJ"), defaultProjectIssueJql("ACTIVE"));
  assert.equal(resolveIssueBrowserJql("", undefined, "PROJ"), defaultProjectIssueJql("PROJ"));
});

test("formatProjectCardWidget displays selected project without secrets", () => {
  const lines = formatProjectCardWidget(project, projectPage);
  const text = lines.join("\n");

  assert.match(text, /Selected Jira project/);
  assert.match(text, /CHATAPP/);
  assert.match(text, /聊天APP/);
  assert.equal(text.includes("secret-token"), false);
});

test("formatIssueCardsWidget renders compact issue cards", () => {
  const lines = formatIssueCardsWidget({
    title: "Jira issues · CHATAPP",
    jql: defaultProjectIssueJql("CHATAPP"),
    startAt: 0,
    total: 334,
    returned: 1,
    issues: [issue],
  });
  const text = lines.join("\n");

  assert.match(text, /Jira issues · CHATAPP/);
  assert.match(text, /CHATAPP-5410/);
  assert.match(text, /In Progress/);
  assert.match(text, /anton_liu/);
  assert.equal(text.includes("description"), false);
});

test("createIssuePickerComponent emits status action", () => {
  const actions: string[] = [];
  const component = createIssuePickerComponent(
    {
      jql: defaultProjectIssueJql("CHATAPP"),
      startAt: 0,
      maxResults: 10,
      total: 1,
      returned: 1,
      isLast: true,
      issues: [issue],
    },
    (action) => actions.push(action.type),
  );

  assert.match(component.render(80).join("\n"), /s status/);
  component.handleInput?.("s");

  assert.deepEqual(actions, ["status"]);
});

test("createPagedPickerComponent emits select next previous filter clear and cancel actions", () => {
  const actions: string[] = [];
  const component = createPagedPickerComponent(
    {
      title: "Projects",
      pageInfo: "1 of 2",
      items: [
        { value: "CHATAPP", label: "CHATAPP", description: "聊天APP" },
        { value: "IOS", label: "IOS", description: "iOS組" },
      ],
      canNext: true,
      canPrevious: true,
    },
    (action) => actions.push(action.type === "select" ? `select:${action.item.value}` : action.type),
  );

  assert.match(component.render(80).join("\n"), /> CHATAPP/);
  component.handleInput?.("\u001b[B");
  component.handleInput?.("\r");
  component.handleInput?.("n");
  component.handleInput?.("p");
  component.handleInput?.("/");
  component.handleInput?.("c");
  component.handleInput?.("\u001b");

  assert.deepEqual(actions, ["select:IOS", "next", "previous", "filter", "clear", "cancel"]);
});

test("registerJiraBrowserCommands registers project and issue commands", () => {
  const commands: string[] = [];
  registerJiraBrowserCommands(
    {
      registerCommand(name: string) {
        commands.push(name);
      },
    } as never,
    "jira-board",
  );

  assert.deepEqual(commands, ["jira-projects", "jira-issues"]);
});

test("project selection sets active Jira project context", async () => {
  clearJiraRuntimeContext();
  const handlers = new Map<string, (args: string, ctx: unknown) => Promise<void>>();
  registerJiraBrowserCommands(
    {
      registerCommand(name: string, command: { handler: (args: string, ctx: unknown) => Promise<void> }) {
        handlers.set(name, command.handler);
      },
    } as never,
    "jira-board",
    {
      loadConfig: () => ({ baseUrl: "https://jira.example.com", user: "user", secret: "secret" }),
      queryProjects: async () => ({
        startAt: 0,
        maxResults: 10,
        total: 1,
        returned: 1,
        isLast: true,
        projects: [project],
      }),
      custom: async (_ctx, page) => ({ type: "select", item: { value: page.projects[0], label: page.projects[0].key } }),
    },
  );

  await handlers.get("jira-projects")?.("CHAT", {
    hasUI: true,
    signal: undefined,
    ui: {
      setWidget() {},
      notify() {},
      input: async () => undefined,
    },
  });

  assert.equal(getActiveJiraProjectKey(), "CHATAPP");
});

test("jira-issues status switch changes status category before re-query", async () => {
  clearJiraRuntimeContext();
  const handlers = new Map<string, (args: string, ctx: unknown) => Promise<void>>();
  const jqls: string[] = [];
  let issueActionCount = 0;

  registerJiraBrowserCommands(
    {
      registerCommand(name: string, command: { handler: (args: string, ctx: unknown) => Promise<void> }) {
        handlers.set(name, command.handler);
      },
      appendEntry() {},
    } as never,
    "jira-board",
    {
      loadConfig: () => ({ baseUrl: "https://jira.example.com", user: "user", secret: "secret", project: "CHATAPP" }),
      queryIssuePage: async (_config, jql) => {
        jqls.push(jql ?? "");
        return { jql: jql ?? "", startAt: 0, maxResults: 10, total: 0, returned: 0, isLast: true, issues: [] };
      },
      customIssue: async () => (issueActionCount++ === 0 ? { type: "status" } : { type: "cancel" }),
    },
  );

  await handlers.get("jira-issues")?.("", {
    hasUI: true,
    signal: undefined,
    ui: {
      setWidget() {},
      notify() {},
      input: async () => undefined,
      select: async () => "all",
    },
  });

  assert.deepEqual(jqls, [
    "project = CHATAPP AND statusCategory != Done ORDER BY updated DESC",
    "project = CHATAPP ORDER BY updated DESC",
  ]);
});

test("jira-issues assignee facet searches assignable users from typed query", async () => {
  clearJiraRuntimeContext();
  const handlers = new Map<string, (args: string, ctx: unknown) => Promise<void>>();
  const jqls: string[] = [];
  let issueActionCount = 0;

  registerJiraBrowserCommands(
    {
      registerCommand(name: string, command: { handler: (args: string, ctx: unknown) => Promise<void> }) {
        handlers.set(name, command.handler);
      },
      appendEntry() {},
    } as never,
    "jira-board",
    {
      loadConfig: () => ({ baseUrl: "https://jira.example.com", user: "user", secret: "secret", project: "CHATAPP" }),
      fetchAssignableUsers: async (_config, projectKey, query) => {
        assert.equal(projectKey, "CHATAPP");
        assert.equal(query, "anton");
        return [{ value: "anton_liu", label: "Anton Liu", description: "anton_liu" }];
      },
      queryIssuePage: async (_config, jql) => {
        jqls.push(jql ?? "");
        return { jql: jql ?? "", startAt: 0, maxResults: 10, total: 0, returned: 0, isLast: true, issues: [] };
      },
      customIssue: async () => (issueActionCount++ === 0 ? { type: "filter" } : { type: "cancel" }),
    },
  );

  await handlers.get("jira-issues")?.("", {
    hasUI: true,
    signal: undefined,
    ui: {
      setWidget() {},
      notify() {},
      input: async () => "anton",
      select: async () => "Assignee",
      custom: async () => ({ type: "select", item: { value: { value: "anton_liu", label: "Anton Liu" }, label: "Anton Liu" } }),
    },
  });

  assert.deepEqual(jqls, [
    "project = CHATAPP AND statusCategory != Done ORDER BY updated DESC",
    "project = CHATAPP AND assignee = anton_liu AND statusCategory != Done ORDER BY updated DESC",
  ]);
});

test("jira-issues assignee facet reports no assignable users for typed query", async () => {
  clearJiraRuntimeContext();
  const handlers = new Map<string, (args: string, ctx: unknown) => Promise<void>>();
  const notifications: string[] = [];
  let issueActionCount = 0;

  registerJiraBrowserCommands(
    {
      registerCommand(name: string, command: { handler: (args: string, ctx: unknown) => Promise<void> }) {
        handlers.set(name, command.handler);
      },
      appendEntry() {},
    } as never,
    "jira-board",
    {
      loadConfig: () => ({ baseUrl: "https://jira.example.com", user: "user", secret: "secret", project: "CHATAPP" }),
      fetchAssignableUsers: async () => [],
      queryIssuePage: async (_config, jql) => ({ jql: jql ?? "", startAt: 0, maxResults: 10, total: 0, returned: 0, isLast: true, issues: [] }),
      customIssue: async () => (issueActionCount++ === 0 ? { type: "filter" } : { type: "cancel" }),
    },
  );

  await handlers.get("jira-issues")?.("", {
    hasUI: true,
    signal: undefined,
    ui: {
      setWidget() {},
      notify(message: string) {
        notifications.push(message);
      },
      input: async () => "missing",
      select: async () => "Assignee",
      custom: async () => ({ type: "cancel" }),
    },
  });

  assert.deepEqual(notifications, ['No assignable Jira users found for "missing" in CHATAPP']);
});

test("jira-issues issue type facet uses project metadata so Sub-task can be selected", async () => {
  clearJiraRuntimeContext();
  const handlers = new Map<string, (args: string, ctx: unknown) => Promise<void>>();
  const jqls: string[] = [];
  let issueActionCount = 0;

  registerJiraBrowserCommands(
    {
      registerCommand(name: string, command: { handler: (args: string, ctx: unknown) => Promise<void> }) {
        handlers.set(name, command.handler);
      },
      appendEntry() {},
    } as never,
    "jira-board",
    {
      loadConfig: () => ({ baseUrl: "https://jira.example.com", user: "user", secret: "secret", project: "CHATAPP" }),
      fetchIssueTypes: async (_config, projectKey) => {
        assert.equal(projectKey, "CHATAPP");
        return [{ id: "5", name: "Sub-task", subtask: true }];
      },
      queryIssuePage: async (_config, jql) => {
        jqls.push(jql ?? "");
        return { jql: jql ?? "", startAt: 0, maxResults: 10, total: 0, returned: 0, isLast: true, issues: [] };
      },
      customIssue: async () => (issueActionCount++ === 0 ? { type: "filter" } : { type: "cancel" }),
    },
  );

  await handlers.get("jira-issues")?.("", {
    hasUI: true,
    signal: undefined,
    ui: {
      setWidget() {},
      notify() {},
      input: async () => undefined,
      select: async () => "Issue Type",
      custom: async () => ({ type: "select", item: { value: { value: "Sub-task", label: "Sub-task" }, label: "Sub-task" } }),
    },
  });

  assert.deepEqual(jqls, [
    "project = CHATAPP AND statusCategory != Done ORDER BY updated DESC",
    'project = CHATAPP AND issuetype = "Sub-task" AND statusCategory != Done ORDER BY updated DESC',
  ]);
});

test("jira-issues uses active Scrum board sprint scope when active sprint exists", async () => {
  clearJiraRuntimeContext();
  setActiveJiraBoard({ id: 123, name: "iOS Scrum", type: "scrum", projectKey: "CHATAPP" });
  const handlers = new Map<string, (args: string, ctx: unknown) => Promise<void>>();
  const jqls: string[] = [];

  registerJiraBrowserCommands(
    {
      registerCommand(name: string, command: { handler: (args: string, ctx: unknown) => Promise<void> }) {
        handlers.set(name, command.handler);
      },
      appendEntry() {},
    } as never,
    "jira-board",
    {
      loadConfig: () => ({ baseUrl: "https://jira.example.com", user: "user", secret: "secret", project: "CHATAPP" }),
      fetchActiveSprint: async () => ({ activeSprint: { id: 42, name: "Sprint 42", state: "active" } }),
      queryIssuePage: async (_config, jql) => {
        jqls.push(jql ?? "");
        return { jql: jql ?? "", startAt: 0, maxResults: 10, total: 0, returned: 0, isLast: true, issues: [] };
      },
      customIssue: async () => ({ type: "cancel" }),
    },
  );

  await handlers.get("jira-issues")?.("", {
    hasUI: true,
    signal: undefined,
    ui: { setWidget() {}, notify() {}, input: async () => undefined, select: async () => undefined },
  });

  assert.deepEqual(jqls, ["sprint = 42 AND statusCategory != Done ORDER BY updated DESC"]);
  assert.equal(getJiraCurrentContext().filterSummary, "Sprint 42 · not done");
});

test("jira-issues uses active Kanban board saved filter scope", async () => {
  clearJiraRuntimeContext();
  setActiveJiraBoard({ id: 123, name: "Web Kanban", type: "kanban", projectKey: "CHATAPP" });
  const handlers = new Map<string, (args: string, ctx: unknown) => Promise<void>>();
  const jqls: string[] = [];

  registerJiraBrowserCommands(
    {
      registerCommand(name: string, command: { handler: (args: string, ctx: unknown) => Promise<void> }) {
        handlers.set(name, command.handler);
      },
      appendEntry() {},
    } as never,
    "jira-board",
    {
      loadConfig: () => ({ baseUrl: "https://jira.example.com", user: "user", secret: "secret", project: "CHATAPP" }),
      fetchKanbanFilterScope: async () => ({
        scope: { filterId: "10001", name: "Web Open Issues", jql: "project = CHATAPP ORDER BY Rank ASC" },
      }),
      queryIssuePage: async (_config, jql) => {
        jqls.push(jql ?? "");
        return { jql: jql ?? "", startAt: 0, maxResults: 10, total: 0, returned: 0, isLast: true, issues: [] };
      },
      customIssue: async () => ({ type: "cancel" }),
    },
  );

  await handlers.get("jira-issues")?.("", {
    hasUI: true,
    signal: undefined,
    ui: { setWidget() {}, notify() {}, input: async () => undefined, select: async () => undefined },
  });

  assert.deepEqual(jqls, ["(project = CHATAPP) AND statusCategory != Done ORDER BY Rank ASC"]);
  assert.equal(getJiraCurrentContext().filterSummary, 'Board filter "Web Open Issues" · not done');
});

test("jira-issues falls back to project scope when active Kanban board filter lookup fails", async () => {
  clearJiraRuntimeContext();
  setActiveJiraBoard({ id: 123, name: "Web Kanban", type: "kanban", projectKey: "CHATAPP" });
  const handlers = new Map<string, (args: string, ctx: unknown) => Promise<void>>();
  const jqls: string[] = [];
  const notifications: string[] = [];

  registerJiraBrowserCommands(
    {
      registerCommand(name: string, command: { handler: (args: string, ctx: unknown) => Promise<void> }) {
        handlers.set(name, command.handler);
      },
      appendEntry() {},
    } as never,
    "jira-board",
    {
      loadConfig: () => ({ baseUrl: "https://jira.example.com", user: "user", secret: "secret", project: "CHATAPP" }),
      fetchKanbanFilterScope: async () => ({ warning: "Board filter lookup failed; using project scope" }),
      queryIssuePage: async (_config, jql) => {
        jqls.push(jql ?? "");
        return { jql: jql ?? "", startAt: 0, maxResults: 10, total: 0, returned: 0, isLast: true, issues: [] };
      },
      customIssue: async () => ({ type: "cancel" }),
    },
  );

  await handlers.get("jira-issues")?.("", {
    hasUI: true,
    signal: undefined,
    ui: {
      setWidget() {},
      notify(message: string) {
        notifications.push(message);
      },
      input: async () => undefined,
      select: async () => undefined,
    },
  });

  assert.deepEqual(jqls, [defaultProjectIssueJql("CHATAPP")]);
  assert.deepEqual(notifications, ["Board filter lookup failed; using project scope"]);
});

test("jira-issues falls back to project scope when active Scrum board has no active sprint", async () => {
  clearJiraRuntimeContext();
  setActiveJiraBoard({ id: 123, name: "iOS Scrum", type: "scrum", projectKey: "CHATAPP" });
  const handlers = new Map<string, (args: string, ctx: unknown) => Promise<void>>();
  const jqls: string[] = [];
  const notifications: string[] = [];

  registerJiraBrowserCommands(
    {
      registerCommand(name: string, command: { handler: (args: string, ctx: unknown) => Promise<void> }) {
        handlers.set(name, command.handler);
      },
      appendEntry() {},
    } as never,
    "jira-board",
    {
      loadConfig: () => ({ baseUrl: "https://jira.example.com", user: "user", secret: "secret", project: "CHATAPP" }),
      fetchActiveSprint: async () => ({ warning: "No active sprint for iOS Scrum; using project scope" }),
      queryIssuePage: async (_config, jql) => {
        jqls.push(jql ?? "");
        return { jql: jql ?? "", startAt: 0, maxResults: 10, total: 0, returned: 0, isLast: true, issues: [] };
      },
      customIssue: async () => ({ type: "cancel" }),
    },
  );

  await handlers.get("jira-issues")?.("", {
    hasUI: true,
    signal: undefined,
    ui: {
      setWidget() {},
      notify(message: string) {
        notifications.push(message);
      },
      input: async () => undefined,
      select: async () => undefined,
    },
  });

  assert.deepEqual(jqls, [defaultProjectIssueJql("CHATAPP")]);
  assert.deepEqual(notifications, ["No active sprint for iOS Scrum; using project scope"]);
});

test("browser commands refuse without interactive UI", async () => {
  const handlers = new Map<string, (args: string, ctx: unknown) => Promise<void>>();
  registerJiraBrowserCommands(
    {
      registerCommand(name: string, command: { handler: (args: string, ctx: unknown) => Promise<void> }) {
        handlers.set(name, command.handler);
      },
    } as never,
    "jira-board",
  );

  const notifications: string[] = [];
  const ctx = {
    hasUI: false,
    ui: {
      notify(message: string) {
        notifications.push(message);
      },
    },
  };

  await handlers.get("jira-projects")?.("", ctx);
  await handlers.get("jira-issues")?.("", ctx);

  assert.deepEqual(notifications, [
    "/jira-projects requires interactive UI",
    "/jira-issues requires interactive UI",
  ]);
});
