import assert from "node:assert/strict";
import test from "node:test";

import {
  JIRA_CONTEXT_ENTRY_TYPE,
  captureJiraRuntimeContext,
  clearJiraRuntimeContext,
  getActiveJiraProjectKey,
  getFocusedJiraIssueKey,
  setActiveJiraBoard,
  setActiveJiraProject,
  setFocusedJiraIssue,
  setJiraIssueFilterSummary,
} from "./jira-context.ts";
import { registerJiraClearCommand } from "./jira-clear.ts";

const project = { id: "1", key: "CHATAPP", name: "Chat App" };
const issue = {
  key: "CHATAPP-1",
  url: "https://jira.example.com/browse/CHATAPP-1",
  summary: "Issue summary",
  status: "In Progress",
  statusCategory: "indeterminate",
  labels: [],
  descriptionTruncated: false,
};

test("jira-clear clears active Jira runtime context and persists empty context entry", async () => {
  clearJiraRuntimeContext();
  setActiveJiraProject(project);
  setActiveJiraBoard({ id: 123, name: "Board", type: "kanban", projectKey: "CHATAPP" });
  setJiraIssueFilterSummary("CHATAPP · not done");
  setFocusedJiraIssue(issue);

  const entries: unknown[] = [];
  const commands = new Map<string, (args: string, ctx: unknown) => Promise<void>>();
  const notifications: string[] = [];
  registerJiraClearCommand(
    {
      registerCommand(name: string, command: { handler: (args: string, ctx: unknown) => Promise<void> }) {
        commands.set(name, command.handler);
      },
      appendEntry(type: string, data: unknown) {
        entries.push({ type, data });
      },
    } as never,
    "jira-board",
    { loadConfig: () => ({ baseUrl: "https://jira.example.com", user: "user", secret: "secret", project: "CONFIG" }) },
  );

  await commands.get("jira-clear")?.("", {
    hasUI: true,
    ui: {
      notify(message: string) {
        notifications.push(message);
      },
      setWidget() {},
    },
  });

  assert.equal(getActiveJiraProjectKey(), undefined);
  assert.equal(getFocusedJiraIssueKey(), undefined);
  assert.deepEqual(captureJiraRuntimeContext(), {
    activeProject: undefined,
    activeBoard: undefined,
    filterSummary: undefined,
    focusedIssue: undefined,
  });
  assert.deepEqual(entries, [
    {
      type: JIRA_CONTEXT_ENTRY_TYPE,
      data: {
        activeProject: undefined,
        activeBoard: undefined,
        filterSummary: undefined,
        focusedIssue: undefined,
      },
    },
  ]);
  assert.deepEqual(notifications, ["Cleared Jira project/board/issue context"]);
});
