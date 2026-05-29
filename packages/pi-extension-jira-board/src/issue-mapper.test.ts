import assert from "node:assert/strict";
import test from "node:test";

import { DESCRIPTION_LIMIT, formatIssueSummary, mapJiraIssue } from "./issue-mapper.ts";
import type { JiraIssue } from "./jira-types.ts";

function jiraIssue(overrides: Partial<JiraIssue> = {}): JiraIssue {
  return {
    id: "10001",
    key: "PROJ-123",
    fields: {
      summary: "Implement board widget",
      description: "Build a compact Jira widget for pi.",
      status: { name: "In Progress", statusCategory: { key: "indeterminate" } },
      labels: ["agent", "planning"],
      assignee: { displayName: "Jira User", name: "jira-user", emailAddress: "jira@example.com" },
      priority: { id: "3", name: "Medium" },
      issuetype: { name: "Story" },
    },
    ...overrides,
  };
}

test("mapJiraIssue returns compact planning fields without raw Jira payload", () => {
  const issue = mapJiraIssue(jiraIssue(), "https://jira.example.com", { includeDescription: true });

  assert.deepEqual(issue, {
    key: "PROJ-123",
    url: "https://jira.example.com/browse/PROJ-123",
    summary: "Implement board widget",
    status: "In Progress",
    statusCategory: "indeterminate",
    issueType: "Story",
    priority: "Medium",
    assignee: "Jira User",
    labels: ["agent", "planning"],
    description: "Build a compact Jira widget for pi.",
    descriptionTruncated: false,
  });
});

test("mapJiraIssue omits descriptions unless requested", () => {
  const issue = mapJiraIssue(jiraIssue(), "https://jira.example.com", { includeDescription: false });

  assert.equal(issue.description, undefined);
  assert.equal(issue.descriptionTruncated, false);
});

test("mapJiraIssue truncates long descriptions with explicit marker", () => {
  const issue = mapJiraIssue(
    jiraIssue({ fields: { ...jiraIssue().fields, description: "x".repeat(DESCRIPTION_LIMIT + 50) } }),
    "https://jira.example.com",
    { includeDescription: true },
  );

  assert.equal(issue.descriptionTruncated, true);
  assert.ok(issue.description?.endsWith("\n\n[Description truncated]"));
  assert.ok(issue.description!.length < DESCRIPTION_LIMIT + 50);
});

test("formatIssueSummary produces compact text for LLM context", () => {
  const text = formatIssueSummary(
    mapJiraIssue(jiraIssue(), "https://jira.example.com", { includeDescription: true }),
  );

  assert.match(text, /PROJ-123: Implement board widget/);
  assert.match(text, /Status: In Progress/);
  assert.match(text, /Labels: agent, planning/);
  assert.match(text, /Description/);
  assert.equal(text.includes("\"fields\""), false);
});
