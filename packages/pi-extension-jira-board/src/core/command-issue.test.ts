import assert from "node:assert/strict";
import test from "node:test";

import { clearJiraRuntimeContext, setFocusedJiraIssue } from "../state/context.ts";
import { resolveCommandIssueKey, usageWithFocusedIssue } from "./command-issue.ts";

test("resolveCommandIssueKey prefers explicit issue key over focused issue", () => {
  clearJiraRuntimeContext();
  setFocusedJiraIssue({
    key: "CHATAPP-5410",
    url: "https://jira.example.com/browse/CHATAPP-5410",
    summary: "Focused",
    status: "In Progress",
    statusCategory: "indeterminate",
    labels: [],
    descriptionTruncated: false,
  });

  assert.deepEqual(resolveCommandIssueKey("chatapp-5421"), {
    issueKey: "CHATAPP-5421",
    source: "explicit",
  });
});

test("resolveCommandIssueKey uses focused issue when explicit key is absent", () => {
  clearJiraRuntimeContext();
  setFocusedJiraIssue({
    key: "CHATAPP-5410",
    url: "https://jira.example.com/browse/CHATAPP-5410",
    summary: "Focused",
    status: "In Progress",
    statusCategory: "indeterminate",
    labels: [],
    descriptionTruncated: false,
  });

  assert.deepEqual(resolveCommandIssueKey(""), {
    issueKey: "CHATAPP-5410",
    source: "focused",
  });
});

test("resolveCommandIssueKey reports missing when no key and no focused issue exist", () => {
  clearJiraRuntimeContext();

  assert.deepEqual(resolveCommandIssueKey(""), { issueKey: undefined, source: "missing" });
});

test("usageWithFocusedIssue describes explicit or focused issue behavior", () => {
  assert.equal(
    usageWithFocusedIssue("jira-plan"),
    "Usage: /jira-plan [ISSUE-KEY] or focus an issue with /jira-issues first.",
  );
});
