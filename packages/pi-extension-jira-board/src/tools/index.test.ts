import assert from "node:assert/strict";
import test from "node:test";

import type { JiraConfig } from "../config/index.ts";
import { clearJiraRuntimeContext, getFocusedJiraIssueKeyOrThrow, setFocusedJiraIssue } from "../state/context.ts";
import { buildIssuePath, buildSearchPath, MAX_SEARCH_RESULTS, registerJiraTools, resolveSearchParams } from "./index.ts";

const config: JiraConfig = {
  baseUrl: "https://jira.example.com",
  user: "jira-user",
  secret: "secret-token",
  project: "PROJ",
  boardId: 123,
};

test("buildIssuePath encodes issue key and requests only compact fields", () => {
  assert.equal(
    buildIssuePath("PROJ-123"),
    "/issue/PROJ-123?fields=summary%2Cdescription%2Cstatus%2Clabels%2Cassignee%2Cpriority%2Cissuetype",
  );
});

test("resolveSearchParams defaults to configured project and safe max results", () => {
  const resolved = resolveSearchParams(config, {});

  assert.deepEqual(resolved, {
    jql: "project = PROJ AND statusCategory != Done ORDER BY updated DESC",
    startAt: 0,
    maxResults: 10,
    includeDescriptions: false,
  });
});

test("resolveSearchParams normalizes startAt and caps max results", () => {
  const resolved = resolveSearchParams(config, { jql: "project = PROJ", startAt: -10, maxResults: 100 });

  assert.equal(resolved.startAt, 0);
  assert.equal(resolved.maxResults, MAX_SEARCH_RESULTS);
});

test("resolveSearchParams requires jql when no project is configured", () => {
  assert.throws(
    () => resolveSearchParams({ ...config, project: undefined }, {}),
    /jira_search_issues requires either jql or JIRA_PROJECT/,
  );
});

test("buildSearchPath encodes jql startAt maxResults and compact fields", () => {
  assert.equal(
    buildSearchPath({ jql: "project = PROJ ORDER BY updated DESC", startAt: 10, maxResults: 5 }),
    "/search?jql=project+%3D+PROJ+ORDER+BY+updated+DESC&startAt=10&maxResults=5&fields=summary%2Cdescription%2Cstatus%2Clabels%2Cassignee%2Cpriority%2Cissuetype",
  );
});

test("focused issue key helper throws clearly when no issue is focused", () => {
  clearJiraRuntimeContext();

  assert.throws(() => getFocusedJiraIssueKeyOrThrow(), /No focused Jira issue/);
});

test("focused issue key helper returns focused issue key", () => {
  clearJiraRuntimeContext();
  setFocusedJiraIssue({
    key: "CHATAPP-5410",
    url: "https://jira.example.com/browse/CHATAPP-5410",
    summary: "Focused",
    status: "In Progress",
    statusCategory: "indeterminate",
    issueType: "Task",
    labels: [],
    descriptionTruncated: false,
  });

  assert.equal(getFocusedJiraIssueKeyOrThrow(), "CHATAPP-5410");
});

test("registerJiraTools includes bounded project search tool and context bridge tools", () => {
  const toolNames: string[] = [];
  registerJiraTools({
    registerTool(tool: { name: string }) {
      toolNames.push(tool.name);
    },
  } as never);

  assert.ok(toolNames.includes("jira_search_projects"));
  assert.ok(toolNames.includes("jira_get_current_context"));
  assert.ok(toolNames.includes("jira_get_focused_issue"));
});
