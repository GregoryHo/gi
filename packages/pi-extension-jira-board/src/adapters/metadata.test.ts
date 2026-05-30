import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import test from "node:test";

import type { JiraConfig } from "../config/index.ts";
import {
  buildProjectComponentsPath,
  buildProjectIssueTypesPath,
  buildProjectVersionsPath,
  fetchProjectComponents,
  fetchProjectIssueTypes,
  fetchProjectVersions,
  sortProjectVersionsForPicker,
} from "./metadata.ts";

const config: JiraConfig = {
  baseUrl: "https://jira.example.com",
  user: "jira-user",
  secret: "secret-token",
};

test("sortProjectVersionsForPicker prefers active newest versions", () => {
  const versions = sortProjectVersionsForPicker([
    { id: "10", name: "v1.0", released: true, releaseDate: "2025-01-01" },
    { id: "12", name: "v1.2", released: false, releaseDate: "2025-03-01" },
    { id: "11", name: "v1.1", released: false, releaseDate: "2025-02-01" },
    { id: "9", name: "old", archived: true, released: false, releaseDate: "2026-01-01" },
  ]);

  assert.deepEqual(versions.map((version) => version.name), ["v1.2", "v1.1", "v1.0", "old"]);
});

test("project metadata paths encode project keys", () => {
  assert.equal(buildProjectVersionsPath("CHAT APP"), "/project/CHAT%20APP/versions");
  assert.equal(buildProjectComponentsPath("CHATAPP"), "/project/CHATAPP/components");
  assert.equal(buildProjectIssueTypesPath("CHATAPP"), "/project/CHATAPP/statuses");
});

test("fetchProjectVersions returns compact version names", async () => {
  const server = await withServer((req, res) => {
    assert.equal(req.url, "/rest/api/2/project/CHATAPP/versions");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify([{ id: "1", name: "v1.62", archived: false, released: false }]));
  });

  try {
    assert.deepEqual(await fetchProjectVersions({ ...config, baseUrl: server.baseUrl }, "CHATAPP"), [
      { id: "1", name: "v1.62", archived: false, released: false },
    ]);
  } finally {
    await server.close();
  }
});

test("fetchProjectIssueTypes returns project issue types including subtasks", async () => {
  const server = await withServer((req, res) => {
    assert.equal(req.url, "/rest/api/2/project/CHATAPP/statuses");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify([
      { id: "1", name: "Story", subtask: false },
      { id: "5", name: "Sub-task", subtask: true },
    ]));
  });

  try {
    assert.deepEqual(await fetchProjectIssueTypes({ ...config, baseUrl: server.baseUrl }, "CHATAPP"), [
      { id: "1", name: "Story", subtask: false },
      { id: "5", name: "Sub-task", subtask: true },
    ]);
  } finally {
    await server.close();
  }
});

test("fetchProjectComponents returns compact component names", async () => {
  const server = await withServer((req, res) => {
    assert.equal(req.url, "/rest/api/2/project/CHATAPP/components");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify([{ id: "7", name: "IOS" }]));
  });

  try {
    assert.deepEqual(await fetchProjectComponents({ ...config, baseUrl: server.baseUrl }, "CHATAPP"), [
      { id: "7", name: "IOS" },
    ]);
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
