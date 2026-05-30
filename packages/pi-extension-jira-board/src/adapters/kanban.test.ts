import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import test from "node:test";

import type { JiraConfig } from "../config/index.ts";
import {
  buildBoardConfigurationPath,
  buildFilterPath,
  composeScopedJql,
  fetchKanbanBoardFilterScope,
  splitJqlOrderBy,
} from "./kanban.ts";

const config: JiraConfig = {
  baseUrl: "https://jira.example.com",
  user: "jira-user",
  secret: "secret-token",
  project: "CHATAPP",
};

test("Kanban board paths target board configuration and saved filter endpoints", () => {
  assert.equal(buildBoardConfigurationPath(123), "/board/123/configuration");
  assert.equal(buildFilterPath("10001"), "/filter/10001");
});

test("splitJqlOrderBy separates the final ORDER BY clause", () => {
  assert.deepEqual(splitJqlOrderBy("project = CHATAPP ORDER BY Rank ASC"), {
    where: "project = CHATAPP",
    orderBy: "Rank ASC",
  });
  assert.deepEqual(splitJqlOrderBy("project = CHATAPP"), { where: "project = CHATAPP" });
});

test("composeScopedJql wraps base JQL and preserves existing order", () => {
  assert.equal(
    composeScopedJql({
      baseJql: "project = CHATAPP ORDER BY Rank ASC",
      clauses: ["component = IOS", "statusCategory != Done"],
      fallbackOrderBy: "updated DESC",
    }),
    "(project = CHATAPP) AND component = IOS AND statusCategory != Done ORDER BY Rank ASC",
  );
});

test("composeScopedJql uses fallback order when base JQL has no order", () => {
  assert.equal(
    composeScopedJql({ baseJql: "project = CHATAPP", clauses: ["statusCategory != Done"], fallbackOrderBy: "updated DESC" }),
    "(project = CHATAPP) AND statusCategory != Done ORDER BY updated DESC",
  );
});

test("fetchKanbanBoardFilterScope resolves board configuration filter JQL", async () => {
  const server = await withServer((req, res) => {
    if (req.url === "/rest/agile/1.0/board/123/configuration") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ filter: { id: "10001", name: "Web Open Issues" } }));
      return;
    }
    if (req.url === "/rest/api/2/filter/10001") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: "10001", name: "Web Open Issues", jql: "project = CHATAPP ORDER BY Rank ASC" }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  try {
    const result = await fetchKanbanBoardFilterScope({ ...config, baseUrl: server.baseUrl }, 123);
    assert.deepEqual(result, {
      scope: { filterId: "10001", name: "Web Open Issues", jql: "project = CHATAPP ORDER BY Rank ASC" },
    });
  } finally {
    await server.close();
  }
});

test("fetchKanbanBoardFilterScope returns warning when lookup fails", async () => {
  const server = await withServer((_req, res) => {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ errorMessages: ["boom"] }));
  });

  try {
    const result = await fetchKanbanBoardFilterScope({ ...config, baseUrl: server.baseUrl }, 123);
    assert.equal(result.scope, undefined);
    assert.match(result.warning ?? "", /Board filter lookup failed:/);
  } finally {
    await server.close();
  }
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
