import assert from "node:assert/strict";
import test from "node:test";

import type { JiraConfig } from "./config.ts";
import type { JiraProject } from "./jira-types.ts";
import type { CompactJiraIssue } from "./issue-mapper.ts";
import {
  JIRA_CONTEXT_ENTRY_TYPE,
  applyJiraRuntimeContext,
  captureJiraRuntimeContext,
  clearJiraRuntimeContext,
  formatJiraCurrentContext,
  getActiveJiraProjectKey,
  getFocusedJiraIssueKey,
  getJiraCurrentContext,
  setActiveJiraBoard,
  restoreJiraRuntimeContextFromEntries,
  setActiveJiraProject,
  setFocusedJiraIssue,
  setJiraIssueFilterSummary,
} from "./jira-context.ts";

const config: JiraConfig = {
  baseUrl: "https://jira.example.com",
  user: "jira-user",
  secret: "secret-token",
  project: "CONFIG",
};

const project: JiraProject = {
  id: "1",
  key: "CHATAPP",
  name: "聊天APP",
};

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

test("runtime context applies active project before configured project", () => {
  clearJiraRuntimeContext();
  setActiveJiraProject(project);

  assert.equal(getActiveJiraProjectKey(), "CHATAPP");
  assert.deepEqual(applyJiraRuntimeContext(config), {
    ...config,
    project: "CHATAPP",
  });
});

test("runtime context leaves config unchanged when no active project exists", () => {
  clearJiraRuntimeContext();

  assert.equal(getActiveJiraProjectKey(), undefined);
  assert.deepEqual(applyJiraRuntimeContext(config), config);
});

test("runtime context tracks active board focused issue and filter summary", () => {
  clearJiraRuntimeContext();
  setActiveJiraProject(project);
  setActiveJiraBoard({ id: 123, name: "iOS Scrum", type: "scrum", projectKey: "CHATAPP" });
  setJiraIssueFilterSummary("CHATAPP · not done · fixVersion:v1.62");
  setFocusedJiraIssue(issue);

  assert.equal(getFocusedJiraIssueKey(), "CHATAPP-5410");
  assert.deepEqual(getJiraCurrentContext(config), {
    project,
    board: { id: 123, name: "iOS Scrum", type: "scrum", projectKey: "CHATAPP" },
    boardId: undefined,
    filterSummary: "CHATAPP · not done · fixVersion:v1.62",
    focusedIssue: {
      key: "CHATAPP-5410",
      summary: "[iOS] 既有功能 API 重構為 core module 模式_Phase 2",
      status: "In Progress",
      priority: "Medium",
      assignee: "anton_liu",
    },
  });
});

test("current context falls back to configured project and board id", () => {
  clearJiraRuntimeContext();

  assert.deepEqual(getJiraCurrentContext({ ...config, boardId: 456 }), {
    project: { key: "CONFIG" },
    board: { id: 456 },
    boardId: 456,
    filterSummary: undefined,
    focusedIssue: undefined,
  });
});

test("current context formats compact non-secret text", () => {
  clearJiraRuntimeContext();
  setActiveJiraProject(project);
  setFocusedJiraIssue(issue);

  const text = formatJiraCurrentContext(getJiraCurrentContext({ ...config, boardId: 456 }));

  assert.match(text, /Current Jira context/);
  assert.match(text, /Project: CHATAPP 聊天APP/);
  assert.match(text, /Board: 456/);
  assert.match(text, /Focused issue: CHATAPP-5410/);
  assert.equal(text.includes("secret-token"), false);
});

test("runtime context can be captured and restored from branch custom entries", () => {
  clearJiraRuntimeContext();
  setActiveJiraProject(project);
  setFocusedJiraIssue(issue);
  const data = captureJiraRuntimeContext();

  clearJiraRuntimeContext();
  restoreJiraRuntimeContextFromEntries([
    { type: "custom", customType: "other", data: { ignored: true } },
    { type: "custom", customType: JIRA_CONTEXT_ENTRY_TYPE, data },
  ]);

  assert.equal(getActiveJiraProjectKey(), "CHATAPP");
  assert.equal(getFocusedJiraIssueKey(), "CHATAPP-5410");
});
