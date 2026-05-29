import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import test from "node:test";

import type { JiraConfig } from "./config.ts";
import {
  buildBoardListPath,
  formatBoardList,
  pageBoards,
  queryJiraBoards,
  registerJiraBoardCommands,
  type JiraBoard,
} from "./jira-boards.ts";
import { clearJiraRuntimeContext, getActiveJiraBoard, setActiveJiraProject } from "./jira-context.ts";

const config: JiraConfig = {
  baseUrl: "https://jira.example.com",
  user: "jira-user",
  secret: "secret-token",
  project: "CHATAPP",
};

const boards: JiraBoard[] = [
  { id: 1, name: "iOS Scrum", type: "scrum" },
  { id: 2, name: "Web Kanban", type: "kanban" },
  { id: 3, name: "Release Kanban", type: "kanban" },
];

test("buildBoardListPath targets Agile board listing for a project with paging", () => {
  assert.equal(
    buildBoardListPath({ projectKey: "CHATAPP", startAt: 10, maxResults: 25 }),
    "/board?projectKeyOrId=CHATAPP&startAt=10&maxResults=25",
  );
});

test("pageBoards filters board name/type case-insensitively", () => {
  const page = pageBoards(boards, { query: "kanban", startAt: 0, maxResults: 1 });

  assert.deepEqual(page, {
    startAt: 0,
    maxResults: 1,
    total: 2,
    returned: 1,
    isLast: false,
    boards: [{ id: 2, name: "Web Kanban", type: "kanban" }],
  });
});

test("formatBoardList returns compact board paging text", () => {
  assert.equal(
    formatBoardList({ startAt: 0, maxResults: 10, total: 2, returned: 2, isLast: true, boards: boards.slice(0, 2) }),
    "Jira boards returned 2 of 2 board(s). startAt=0 maxResults=10 isLast=true\n- 1: iOS Scrum (scrum)\n- 2: Web Kanban (kanban)",
  );
});

test("queryJiraBoards fetches boards through the Agile API", async () => {
  const server = await withServer((req, res) => {
    assert.equal(req.url, "/rest/agile/1.0/board?projectKeyOrId=CHATAPP&startAt=0&maxResults=50");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ startAt: 0, maxResults: 50, total: 2, isLast: true, values: boards.slice(0, 2) }));
  });

  try {
    const page = await queryJiraBoards({ ...config, baseUrl: server.baseUrl }, { maxResults: 50 });
    assert.equal(page.total, 2);
    assert.deepEqual(page.boards, boards.slice(0, 2));
  } finally {
    await server.close();
  }
});

test("registerJiraBoardCommands registers jira-boards and selection sets active board", async () => {
  clearJiraRuntimeContext();
  setActiveJiraProject({ id: "100", key: "CHATAPP", name: "聊天APP" });

  const handlers = new Map<string, (args: string, ctx: unknown) => Promise<void>>();
  registerJiraBoardCommands(
    {
      registerCommand(name: string, command: { handler: (args: string, ctx: unknown) => Promise<void> }) {
        handlers.set(name, command.handler);
      },
      appendEntry() {},
    } as never,
    "jira-board",
    {
      loadConfig: () => config,
      queryBoards: async () => ({ startAt: 0, maxResults: 10, total: 1, returned: 1, isLast: true, boards: [boards[0]] }),
      custom: async (_ctx, page) => ({ type: "select", item: { value: page.boards[0], label: page.boards[0].name } }),
    },
  );

  await handlers.get("jira-boards")?.("", {
    hasUI: true,
    signal: undefined,
    ui: { setWidget() {}, notify() {}, input: async () => undefined },
  });

  assert.deepEqual(getActiveJiraBoard(), { ...boards[0], projectKey: "CHATAPP" });
});

async function withServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}
