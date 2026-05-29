import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import test from "node:test";

import type { JiraConfig } from "./config.ts";
import {
  buildActiveSprintPath,
  formatSnapshotWidget,
  getBoardSnapshot,
  MAX_SNAPSHOT_RESULTS,
  resolveSnapshotMaxResults,
} from "./board-snapshot.ts";
import type { JiraIssue } from "./jira-types.ts";

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

function config(baseUrl: string, overrides: Partial<JiraConfig> = {}): JiraConfig {
  return {
    baseUrl,
    user: "jira-user",
    secret: "secret-token",
    project: "CHATAPP",
    boardId: 123,
    ...overrides,
  };
}

function issue(key: string, status: string, category = "indeterminate"): JiraIssue {
  return {
    id: key.replace("CHATAPP-", ""),
    key,
    fields: {
      summary: `${key} summary`,
      description: "description should not appear in widget",
      status: { name: status, statusCategory: { key: category } },
      labels: [],
      assignee: { displayName: "Greg" },
      priority: { id: "3", name: "Medium" },
      issuetype: { name: "Story" },
    },
  };
}

test("buildActiveSprintPath targets the Jira Agile active sprint endpoint", () => {
  assert.equal(buildActiveSprintPath(123), "/board/123/sprint?state=active");
});

test("resolveSnapshotMaxResults defaults to 25 and caps at 50", () => {
  assert.equal(resolveSnapshotMaxResults(undefined), 25);
  assert.equal(resolveSnapshotMaxResults(100), MAX_SNAPSHOT_RESULTS);
  assert.equal(resolveSnapshotMaxResults(0), 1);
});

test("getBoardSnapshot uses active sprint JQL when board has an active sprint", async () => {
  const requests: string[] = [];
  const server = await withServer((req, res) => {
    requests.push(req.url ?? "");

    if (req.url === "/rest/agile/1.0/board/123/sprint?state=active") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ values: [{ id: 42, name: "Sprint 42", state: "active" }] }));
      return;
    }

    if (req.url?.startsWith("/rest/api/2/search?")) {
      const url = new URL(`http://local${req.url}`);
      assert.equal(url.searchParams.get("jql"), "sprint = 42 AND statusCategory != Done ORDER BY updated DESC");
      assert.equal(url.searchParams.get("maxResults"), "25");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ total: 2, issues: [issue("CHATAPP-1", "BACKLOG"), issue("CHATAPP-2", "Uat Verify")] }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  try {
    const snapshot = await getBoardSnapshot(config(server.baseUrl), { refresh: true });

    assert.equal(snapshot.activeSprint?.id, 42);
    assert.deepEqual(snapshot.statusCounts, { BACKLOG: 1, "Uat Verify": 1 });
    assert.equal(snapshot.returned, 2);
    assert.equal(snapshot.total, 2);
    assert.equal(requests.length, 2);
  } finally {
    await server.close();
  }
});

test("getBoardSnapshot falls back to configured project when board ID is absent", async () => {
  const server = await withServer((req, res) => {
    assert.ok(req.url?.startsWith("/rest/api/2/search?"));
    const url = new URL(`http://local${req.url}`);
    assert.equal(url.searchParams.get("jql"), "project = CHATAPP AND statusCategory != Done ORDER BY updated DESC");

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ total: 1, issues: [issue("CHATAPP-1", "BACKLOG")] }));
  });

  try {
    const snapshot = await getBoardSnapshot(config(server.baseUrl, { boardId: undefined }), { refresh: true });
    assert.equal(snapshot.activeSprint, undefined);
    assert.equal(snapshot.project, "CHATAPP");
    assert.equal(snapshot.returned, 1);
  } finally {
    await server.close();
  }
});

test("getBoardSnapshot caches snapshots unless refresh is requested", async () => {
  let searchCount = 0;
  const server = await withServer((req, res) => {
    if (req.url === "/rest/agile/1.0/board/123/sprint?state=active") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ values: [] }));
      return;
    }

    searchCount += 1;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ total: searchCount, issues: [issue(`CHATAPP-${searchCount}`, "BACKLOG")] }));
  });

  try {
    const cfg = config(server.baseUrl);
    const first = await getBoardSnapshot(cfg, { refresh: true });
    const second = await getBoardSnapshot(cfg, {});
    const third = await getBoardSnapshot(cfg, { refresh: true });

    assert.equal(first.total, 1);
    assert.equal(second.total, 1);
    assert.equal(third.total, 2);
    assert.equal(searchCount, 2);
  } finally {
    await server.close();
  }
});

test("formatSnapshotWidget is compact and omits descriptions", () => {
  const lines = formatSnapshotWidget({
    project: "CHATAPP",
    boardId: 123,
    activeSprint: { id: 42, name: "Sprint 42", state: "active" },
    jql: "sprint = 42 AND statusCategory != Done ORDER BY updated DESC",
    total: 2,
    returned: 2,
    statusCounts: { BACKLOG: 1, "Uat Verify": 1 },
    issues: [
      {
        key: "CHATAPP-1",
        url: "https://jira.example.com/browse/CHATAPP-1",
        summary: "One",
        status: "BACKLOG",
        statusCategory: "new",
        labels: [],
        description: "must not show",
        descriptionTruncated: false,
      },
    ],
    warnings: [],
  });

  assert.deepEqual(lines, [
    "Jira CHATAPP / Board 123",
    "Sprint: Sprint 42",
    "Issues: 2 of 2",
    "Status: BACKLOG 1 | Uat Verify 1",
    "Recent: CHATAPP-1",
  ]);
});
