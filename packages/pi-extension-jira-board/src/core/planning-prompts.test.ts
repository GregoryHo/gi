import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFixPlanPrompt,
  buildImplementationPlanPrompt,
  extractIssueKey,
  formatIssueWidgetLines,
} from "./planning-prompts.ts";
import type { CompactJiraIssue } from "./issue-mapper.ts";

const issue: CompactJiraIssue = {
  key: "CHATAPP-5421",
  url: "https://jira.example.com/browse/CHATAPP-5421",
  summary: "IMCoreKit 使用者設定相關API重構",
  status: "Uat Verify",
  statusCategory: "indeterminate",
  issueType: "Sub-Task",
  priority: "Medium",
  assignee: "gregory_ho",
  labels: ["im", "refactor"],
  description: "影響範圍：加好友、解除好友、黑名單、通知設定、修改密碼、刪除帳號、上傳大頭照。",
  descriptionTruncated: false,
};

test("extractIssueKey accepts a Jira key from command args", () => {
  assert.equal(extractIssueKey(" CHATAPP-5421 "), "CHATAPP-5421");
  assert.equal(extractIssueKey("chatapp-5421"), "CHATAPP-5421");
});

test("extractIssueKey returns undefined when args do not contain an issue key", () => {
  assert.equal(extractIssueKey(""), undefined);
  assert.equal(extractIssueKey("CHATAPP"), undefined);
});

test("buildImplementationPlanPrompt includes implementation planning sections and compact issue context", () => {
  const prompt = buildImplementationPlanPrompt(issue);

  assert.match(prompt, /CHATAPP-5421/);
  assert.match(prompt, /IMCoreKit 使用者設定相關API重構/);
  assert.match(prompt, /Implementation plan/);
  assert.match(prompt, /Test plan/);
  assert.match(prompt, /Risks/);
  assert.match(prompt, /Unknowns and clarifying questions/);
  assert.match(prompt, /Likely affected modules/);
  assert.equal(prompt.includes('"fields"'), false);
  assert.equal(prompt.includes("secret-token"), false);
});

test("buildFixPlanPrompt is biased toward root-cause debugging and regression tests", () => {
  const prompt = buildFixPlanPrompt(issue);

  assert.match(prompt, /Bug-fix plan/);
  assert.match(prompt, /Reproduction/);
  assert.match(prompt, /Root-cause investigation/);
  assert.match(prompt, /Minimal fix strategy/);
  assert.match(prompt, /Regression tests/);
  assert.match(prompt, /Unknowns and clarifying questions/);
});

test("formatIssueWidgetLines displays compact issue context without description", () => {
  assert.deepEqual(formatIssueWidgetLines(issue), [
    "Jira CHATAPP-5421",
    "IMCoreKit 使用者設定相關API重構",
    "Status: Uat Verify | Type: Sub-Task | Priority: Medium",
    "Assignee: gregory_ho",
    "Labels: im, refactor",
  ]);
});
