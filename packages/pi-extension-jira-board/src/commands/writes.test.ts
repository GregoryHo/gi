import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAddCommentBody,
  buildAddCommentPath,
  buildTransitionIssueBody,
  buildTransitionIssuePath,
  buildTransitionsPath,
  formatCommentPreview,
  formatTransitionPreview,
  parseWriteIssueKey,
} from "./writes.ts";
import type { JiraTransition } from "../types.ts";

const transition: JiraTransition = {
  id: "31",
  name: "Done",
  to: {
    name: "Done",
    statusCategory: { key: "done" },
  },
};

test("parseWriteIssueKey extracts an uppercase Jira issue key", () => {
  assert.equal(parseWriteIssueKey(" chatapp-5421 "), "CHATAPP-5421");
  assert.equal(parseWriteIssueKey("CHATAPP"), undefined);
});

test("buildAddCommentPath encodes the issue key", () => {
  assert.equal(buildAddCommentPath("CHATAPP-5421"), "/issue/CHATAPP-5421/comment");
});

test("buildAddCommentBody preserves the exact comment text", () => {
  assert.equal(buildAddCommentBody("hello\nworld"), JSON.stringify({ body: "hello\nworld" }));
});

test("buildTransitionsPath encodes the issue key", () => {
  assert.equal(buildTransitionsPath("CHATAPP-5421"), "/issue/CHATAPP-5421/transitions");
});

test("buildTransitionIssuePath encodes the issue key", () => {
  assert.equal(buildTransitionIssuePath("CHATAPP-5421"), "/issue/CHATAPP-5421/transitions");
});

test("buildTransitionIssueBody includes only the transition id", () => {
  assert.equal(buildTransitionIssueBody(transition), JSON.stringify({ transition: { id: "31" } }));
});

test("formatCommentPreview includes issue key and comment body", () => {
  assert.equal(
    formatCommentPreview("CHATAPP-5421", "hello"),
    "Add this comment to CHATAPP-5421?\n\nhello",
  );
});

test("formatTransitionPreview includes issue key transition and target status", () => {
  assert.equal(formatTransitionPreview("CHATAPP-5421", transition), "Move CHATAPP-5421 with transition: Done → Done?");
});
