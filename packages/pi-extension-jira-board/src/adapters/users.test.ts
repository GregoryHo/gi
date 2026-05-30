import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import test from "node:test";

import type { JiraConfig } from "../config/index.ts";
import { buildAssignableUsersPath, fetchAssignableUsers, rankAssignableUsers, userFacetValue } from "./users.ts";

const config: JiraConfig = {
  baseUrl: "https://jira.example.com",
  user: "jira-user",
  secret: "secret-token",
  project: "CHATAPP",
};

test("buildAssignableUsersPath targets Jira Server/DC assignable username search", () => {
  assert.equal(
    buildAssignableUsersPath({ project: "CHATAPP", query: "anton", maxResults: 50 }),
    "/user/assignable/search?project=CHATAPP&username=anton&maxResults=50",
  );
});

test("rankAssignableUsers puts exact and prefix username matches first", () => {
  const ranked = rankAssignableUsers(
    [
      { name: "random_user", displayName: "Random User" },
      { name: "gregory_ho_backup", displayName: "Greg Backup" },
      { name: "gregory_ho", displayName: "Gregory Ho" },
      { name: "other", displayName: "Gregory Ho External" },
    ],
    "gregory_ho",
  );

  assert.deepEqual(ranked.map((user) => user.name), ["gregory_ho", "gregory_ho_backup", "other", "random_user"]);
});

test("userFacetValue prefers Jira username for assignee JQL", () => {
  assert.deepEqual(
    userFacetValue({ name: "anton_liu", displayName: "Anton Liu", emailAddress: "anton@example.com" }),
    { value: "anton_liu", label: "Anton Liu", description: "anton_liu · anton@example.com" },
  );
});

test("fetchAssignableUsers queries Jira users and normalizes picker values", async () => {
  const server = await withServer((req, res) => {
    assert.equal(req.url, "/rest/api/2/user/assignable/search?project=CHATAPP&username=anton&maxResults=50");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify([{ name: "anton_liu", displayName: "Anton Liu", emailAddress: "anton@example.com" }]));
  });

  try {
    assert.deepEqual(await fetchAssignableUsers({ ...config, baseUrl: server.baseUrl }, "CHATAPP", "anton"), [
      { value: "anton_liu", label: "Anton Liu", description: "anton_liu · anton@example.com" },
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
