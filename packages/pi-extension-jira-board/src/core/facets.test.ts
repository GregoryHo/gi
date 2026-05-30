import assert from "node:assert/strict";
import test from "node:test";

import type { CompactJiraIssue } from "./issue-mapper.ts";
import {
  addIssueFilter,
  buildFacetedIssueJql,
  collectIssueFacetValues,
  filterSummary,
  removeIssueFilters,
  type IssueFilterState,
} from "./facets.ts";

const issues: CompactJiraIssue[] = [
  {
    key: "CHATAPP-1",
    url: "https://jira.example.com/browse/CHATAPP-1",
    summary: "One",
    status: "In Progress",
    statusCategory: "indeterminate",
    issueType: "Task",
    priority: "Medium",
    assignee: "anton_liu",
    labels: ["ios", "core"],
    descriptionTruncated: false,
  },
  {
    key: "CHATAPP-2",
    url: "https://jira.example.com/browse/CHATAPP-2",
    summary: "Two",
    status: "BACKLOG",
    statusCategory: "new",
    issueType: "Bug",
    priority: "Low",
    assignee: "bryce_ni",
    labels: ["ios"],
    descriptionTruncated: false,
  },
];

test("collectIssueFacetValues aggregates unique values from compact issues", () => {
  assert.deepEqual(collectIssueFacetValues(issues), {
    labels: ["core", "ios"],
    assignees: ["anton_liu", "bryce_ni"],
    statuses: ["BACKLOG", "In Progress"],
    priorities: ["Low", "Medium"],
    issueTypes: ["Bug", "Task"],
  });
});

test("buildFacetedIssueJql supports Kanban saved filter scope", () => {
  const state: IssueFilterState = {
    project: "CHATAPP",
    scope: {
      type: "jql",
      jql: "project = CHATAPP ORDER BY Rank ASC",
      summary: 'Board filter "Web Open Issues"',
    },
    statusMode: "notDone",
    filters: [{ type: "component", value: "IOS" }],
  };

  assert.equal(
    buildFacetedIssueJql(state),
    "(project = CHATAPP) AND component = IOS AND statusCategory != Done ORDER BY Rank ASC",
  );
  assert.equal(filterSummary(state), 'Board filter "Web Open Issues" · not done · component:IOS');
});

test("buildFacetedIssueJql supports Scrum active sprint scope", () => {
  const state: IssueFilterState = {
    project: "CHATAPP",
    scope: { type: "sprint", sprintId: 42, summary: "Sprint 42" },
    statusMode: "notDone",
    filters: [{ type: "component", value: "IOS" }],
  };

  assert.equal(
    buildFacetedIssueJql(state),
    "sprint = 42 AND component = IOS AND statusCategory != Done ORDER BY updated DESC",
  );
  assert.equal(filterSummary(state), "Sprint 42 · not done · component:IOS");
});

test("addIssueFilter appends field filters and buildFacetedIssueJql renders JQL", () => {
  let state: IssueFilterState = { project: "CHATAPP", statusMode: "notDone" };
  state = addIssueFilter(state, { type: "fixVersion", value: "v1.62" });
  state = addIssueFilter(state, { type: "component", value: "IOS" });
  state = addIssueFilter(state, { type: "label", value: "core" });

  assert.equal(
    buildFacetedIssueJql(state),
    'project = CHATAPP AND fixVersion = "v1.62" AND component = IOS AND labels = core AND statusCategory != Done ORDER BY updated DESC',
  );
});

test("removeIssueFilters clears non-project filters but keeps project and status mode", () => {
  const state = removeIssueFilters({
    project: "CHATAPP",
    statusMode: "done",
    filters: [{ type: "component", value: "IOS" }],
  });

  assert.deepEqual(state, { project: "CHATAPP", statusMode: "done", filters: [] });
});

test("filterSummary describes active filters compactly", () => {
  assert.equal(
    filterSummary({
      project: "CHATAPP",
      statusMode: "notDone",
      filters: [
        { type: "fixVersion", value: "v1.62" },
        { type: "component", value: "IOS" },
      ],
    }),
    "CHATAPP · not done · fixVersion:v1.62 · component:IOS",
  );
});
