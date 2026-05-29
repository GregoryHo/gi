import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import test from "node:test";

import { jiraAgileFetch, jiraApiFetch, validateJiraConnectivity } from "./jira-client.ts";
import type { JiraConfig } from "./config.ts";

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

function testConfig(baseUrl: string): JiraConfig {
  return {
    baseUrl,
    user: "jira-user",
    secret: "secret-token",
    project: "PROJ",
    boardId: 123,
  };
}

test("jiraApiFetch calls the core REST API with basic auth and JSON headers", async () => {
  const server = await withServer((req, res) => {
    assert.equal(req.url, "/rest/api/2/myself");
    assert.equal(req.method, "GET");
    assert.equal(req.headers.authorization, `Basic ${Buffer.from("jira-user:secret-token").toString("base64")}`);
    assert.equal(req.headers.accept, "application/json");
    assert.equal(req.headers["content-type"], "application/json");

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ name: "jira-user" }));
  });

  try {
    const result = await jiraApiFetch<{ name: string }>(testConfig(server.baseUrl), "/myself");
    assert.deepEqual(result, { name: "jira-user" });
  } finally {
    await server.close();
  }
});

test("jiraAgileFetch calls the agile REST API and returns undefined for 204", async () => {
  const server = await withServer((req, res) => {
    assert.equal(req.url, "/rest/agile/1.0/board/123/sprint?state=active");
    assert.equal(req.method, "GET");
    res.writeHead(204);
    res.end();
  });

  try {
    const result = await jiraAgileFetch<undefined>(testConfig(server.baseUrl), "/board/123/sprint?state=active");
    assert.equal(result, undefined);
  } finally {
    await server.close();
  }
});

test("jiraApiFetch throws sanitized errors with method path status and truncated body", async () => {
  const server = await withServer((_req, res) => {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("x".repeat(500));
  });

  try {
    await assert.rejects(
      () => jiraApiFetch(testConfig(server.baseUrl), "/fail", { method: "POST" }),
      (error) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Jira API POST \/fail failed \(500\)/);
        assert.ok(error.message.length < 300);
        assert.equal(error.message.includes("secret-token"), false);
        return true;
      },
    );
  } finally {
    await server.close();
  }
});

test("validateJiraConnectivity reads the current Jira user", async () => {
  const server = await withServer((req, res) => {
    assert.equal(req.url, "/rest/api/2/myself");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ name: "jira-user", displayName: "Jira User" }));
  });

  try {
    const result = await validateJiraConnectivity(testConfig(server.baseUrl));
    assert.deepEqual(result, { ok: true, userLabel: "Jira User" });
  } finally {
    await server.close();
  }
});
