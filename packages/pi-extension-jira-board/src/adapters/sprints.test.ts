import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import test from "node:test";

import type { JiraConfig } from "../config/index.ts";
import { buildActiveSprintPath, fetchActiveSprintForBoard } from "./sprints.ts";

const config: JiraConfig = {
  baseUrl: "https://jira.example.com",
  user: "jira-user",
  secret: "secret-token",
  project: "CHATAPP",
};

test("buildActiveSprintPath targets the Jira Agile active sprint endpoint", () => {
  assert.equal(buildActiveSprintPath(123), "/board/123/sprint?state=active");
});

test("fetchActiveSprintForBoard returns the first active sprint", async () => {
  const server = await withServer((req, res) => {
    assert.equal(req.url, "/rest/agile/1.0/board/123/sprint?state=active");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ values: [{ id: 42, name: "Sprint 42", state: "active" }] }));
  });

  try {
    const result = await fetchActiveSprintForBoard({ ...config, baseUrl: server.baseUrl }, 123);
    assert.deepEqual(result, { activeSprint: { id: 42, name: "Sprint 42", state: "active" } });
  } finally {
    await server.close();
  }
});

test("fetchActiveSprintForBoard returns a warning when lookup fails", async () => {
  const server = await withServer((_req, res) => {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ errorMessages: ["boom"] }));
  });

  try {
    const result = await fetchActiveSprintForBoard({ ...config, baseUrl: server.baseUrl }, 123);
    assert.equal(result.activeSprint, undefined);
    assert.match(result.warning ?? "", /Active sprint lookup failed:/);
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
