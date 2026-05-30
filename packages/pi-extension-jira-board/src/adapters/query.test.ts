import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import test from "node:test";

import type { JiraConfig } from "../config/index.ts";
import type { JiraProject } from "../types.ts";
import {
  buildProjectListPath,
  formatProjectList,
  MAX_PROJECT_RESULTS,
  pageProjects,
  queryJiraProjects,
  resolveProjectQueryParams,
} from "./query.ts";

const projects: JiraProject[] = [
  { id: "1", key: "CHATAPP", name: "Chat Application" },
  { id: "2", key: "CORE", name: "Core Platform" },
  { id: "3", key: "OPS", name: "Operations" },
];

const config: JiraConfig = {
  baseUrl: "https://jira.example.com",
  user: "jira-user",
  secret: "secret-token",
};

test("resolveProjectQueryParams trims query and caps paging", () => {
  assert.deepEqual(resolveProjectQueryParams({ query: " chat ", startAt: -10, maxResults: 100 }), {
    query: "chat",
    startAt: 0,
    maxResults: MAX_PROJECT_RESULTS,
  });
});

test("pageProjects filters key and name case-insensitively then pages", () => {
  const page = pageProjects(projects, { query: "app", startAt: 0, maxResults: 1 });

  assert.deepEqual(page, {
    query: "app",
    startAt: 0,
    maxResults: 1,
    total: 1,
    returned: 1,
    isLast: true,
    projects: [{ id: "1", key: "CHATAPP", name: "Chat Application" }],
  });
});

test("pageProjects reports non-last pages", () => {
  const page = pageProjects(projects, { startAt: 1, maxResults: 1 });

  assert.equal(page.total, 3);
  assert.equal(page.returned, 1);
  assert.equal(page.isLast, false);
  assert.deepEqual(page.projects, [{ id: "2", key: "CORE", name: "Core Platform" }]);
});

test("buildProjectListPath uses Jira Server project list endpoint", () => {
  assert.equal(buildProjectListPath(), "/project");
});

test("formatProjectList returns compact paging text", () => {
  const text = formatProjectList(pageProjects(projects, { startAt: 0, maxResults: 2 }));

  assert.match(text, /Jira projects returned 2 of 3 project\(s\)/);
  assert.match(text, /- CHATAPP: Chat Application/);
  assert.match(text, /- CORE: Core Platform/);
  assert.equal(text.includes("secret-token"), false);
});

test("queryJiraProjects fetches projects through the read-only Jira API", async () => {
  const server = await withServer((req, res) => {
    assert.equal(req.url, "/rest/api/2/project");
    assert.equal(req.method, "GET");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(projects));
  });

  try {
    const page = await queryJiraProjects({ ...config, baseUrl: server.baseUrl }, { query: "core" });
    assert.equal(page.total, 1);
    assert.deepEqual(page.projects, [{ id: "2", key: "CORE", name: "Core Platform" }]);
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
