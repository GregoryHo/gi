import assert from "node:assert/strict";
import { test } from "node:test";

import { createSearchResultStore } from "./search-store.ts";
import { registerWebSearchTool } from "./tools.ts";

type RegisteredTool = {
  name: string;
  parameters: {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  execute: (...args: unknown[]) => Promise<{ content: Array<{ type: string; text: string }>; details: Record<string, unknown> }>;
};

test("registerWebSearchTool registers strict web_search and fetch_content schemas", () => {
  const tools: RegisteredTool[] = [];
  const pi = {
    registerTool(tool: unknown) {
      tools.push(tool as RegisteredTool);
    },
  } as Parameters<typeof registerWebSearchTool>[0];

  registerWebSearchTool(pi);

  assert.deepEqual(tools.map((tool) => tool.name), ["web_search", "fetch_content"]);
  assert.deepEqual(tools[0]?.parameters.required, ["query"]);
  assert.ok(tools[0]?.parameters.properties?.query);
  assert.ok(tools[0]?.parameters.properties?.count);
  assert.ok(tools[0]?.parameters.properties?.domainFilter);
  assert.deepEqual(tools[1]?.parameters.required, undefined);
  assert.ok(tools[1]?.parameters.properties?.url);
  assert.ok(tools[1]?.parameters.properties?.responseId);
  assert.ok(tools[1]?.parameters.properties?.resultId);
  assert.ok(tools[1]?.parameters.properties?.index);
  assert.ok(tools[1]?.parameters.properties?.maxChars);
});

test("web_search stores result ids and fetch_content can fetch by responseId/resultId", async () => {
  const tools: RegisteredTool[] = [];
  const pi = {
    registerTool(tool: unknown) {
      tools.push(tool as RegisteredTool);
    },
  } as Parameters<typeof registerWebSearchTool>[0];
  const fetchedUrls: string[] = [];

  registerWebSearchTool(pi, {
    store: createSearchResultStore(),
    search: async () => ({
      query: "pi docs",
      authRoute: "openai-codex",
      answer: "Use the docs.",
      sources: [{ title: "Docs", url: "https://docs.example.com", snippet: "" }],
    }),
    fetch: async (options) => {
      fetchedUrls.push(options.url);
      return {
        url: options.url,
        finalUrl: options.url,
        title: "Docs",
        contentType: "text/html",
        content: "Docs body",
        truncated: false,
      };
    },
  });

  const searchTool = tools.find((tool) => tool.name === "web_search");
  const fetchTool = tools.find((tool) => tool.name === "fetch_content");
  assert.ok(searchTool);
  assert.ok(fetchTool);

  const searchResult = await searchTool.execute("call-1", { query: "pi docs" }, undefined, undefined, undefined);
  assert.equal(searchResult.details.responseId, "ws_1");
  assert.deepEqual((searchResult.details.sources as Array<{ id: string }>).map((source) => source.id), ["r1"]);

  const fetchResult = await fetchTool.execute("call-2", { responseId: "ws_1", resultId: "r1" }, undefined, undefined, undefined);
  assert.deepEqual(fetchedUrls, ["https://docs.example.com"]);
  assert.equal(fetchResult.details.url, "https://docs.example.com");
});
