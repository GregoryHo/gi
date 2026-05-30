import assert from "node:assert/strict";
import test from "node:test";

import { renderJiraCockpitWidget, type JiraCockpitState } from "./cockpit.ts";

const state: JiraCockpitState = {
  project: { key: "CHATAPP", name: "聊天APP" },
  board: { id: 123 },
  filter: { summary: "not done · component:IOS", returned: 10, total: 334, startAt: 0 },
  focusedIssue: {
    key: "CHATAPP-5410",
    summary: "[iOS] 既有功能 API 重構為 core module 模式_Phase 2",
    status: "In Progress",
    priority: "Medium",
    assignee: "anton_liu",
  },
  status: { kind: "ok", message: "connected" },
};

test("renderJiraCockpitWidget compact mode shows one canonical project board filter issue cockpit", () => {
  const lines = renderJiraCockpitWidget(state, "compact");
  const text = lines.join("\n");

  assert.match(text, /Jira · CHATAPP 聊天APP · Board 123/);
  assert.match(text, /Filter: not done · component:IOS · Issues 10\/334 · startAt 0/);
  assert.match(text, /Issue: CHATAPP-5410 In Progress/);
  assert.match(text, /Status: connected/);
  assert.match(text, /Actions: \/jira · \/jira-issues · \/jira-refresh/);
});

test("renderJiraCockpitWidget focus mode emphasizes focused issue", () => {
  const lines = renderJiraCockpitWidget(state, "focus");
  const text = lines.join("\n");

  assert.match(text, /Jira · CHATAPP 聊天APP · Board 123/);
  assert.match(text, /Filter: not done · component:IOS/);
  assert.match(text, /CHATAPP-5410  In Progress  Medium/);
  assert.match(text, /assignee: anton_liu/);
  assert.match(text, /Actions: \/jira-plan · \/jira-fix · \/jira-transition/);
});

test("renderJiraCockpitWidget handles unavailable compact state", () => {
  const lines = renderJiraCockpitWidget(
    { status: { kind: "error", message: "Missing Jira configuration" } },
    "compact",
  );

  assert.deepEqual(lines, [
    "Jira · unavailable",
    "Status: Missing Jira configuration",
    "Actions: /jira-onboarding",
  ]);
});
