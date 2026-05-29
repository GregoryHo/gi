import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGuidedIssueJql,
  parseJiraIssuesArgs,
  quoteJqlValue,
  type GuidedIssueFilters,
} from "./jira-filter.ts";

test("quoteJqlValue leaves simple Jira identifiers unquoted", () => {
  assert.equal(quoteJqlValue("IOS"), "IOS");
  assert.equal(quoteJqlValue("anton_liu"), "anton_liu");
});

test("quoteJqlValue quotes values with dots spaces or special characters", () => {
  assert.equal(quoteJqlValue("v1.62"), '"v1.62"');
  assert.equal(quoteJqlValue("Chat App"), '"Chat App"');
  assert.equal(quoteJqlValue('a"b'), '"a\\"b"');
});

test("buildGuidedIssueJql builds default not-done project query", () => {
  assert.equal(
    buildGuidedIssueJql({ project: "CHATAPP" }),
    "project = CHATAPP AND statusCategory != Done ORDER BY updated DESC",
  );
});

test("buildGuidedIssueJql includes optional fixVersion component assignee and text", () => {
  const filters: GuidedIssueFilters = {
    project: "CHATAPP",
    fixVersion: "v1.62",
    component: "IOS",
    assignee: "anton_liu",
    text: "login error",
  };

  assert.equal(
    buildGuidedIssueJql(filters),
    'project = CHATAPP AND fixVersion = "v1.62" AND component = IOS AND assignee = anton_liu AND text ~ "login error" AND statusCategory != Done ORDER BY updated DESC',
  );
});

test("buildGuidedIssueJql supports all and done status modes", () => {
  assert.equal(buildGuidedIssueJql({ project: "CHATAPP", statusMode: "all" }), "project = CHATAPP ORDER BY updated DESC");
  assert.equal(
    buildGuidedIssueJql({ project: "CHATAPP", statusMode: "done" }),
    "project = CHATAPP AND statusCategory = Done ORDER BY updated DESC",
  );
});

test("parseJiraIssuesArgs treats --jql as advanced raw JQL and plain token as project shorthand", () => {
  assert.deepEqual(parseJiraIssuesArgs('--jql project = CHATAPP AND component = IOS'), {
    mode: "jql",
    jql: "project = CHATAPP AND component = IOS",
  });
  assert.deepEqual(parseJiraIssuesArgs("CHATAPP"), { mode: "project", project: "CHATAPP" });
  assert.deepEqual(parseJiraIssuesArgs(""), { mode: "guided" });
});
