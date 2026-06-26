import assert from "node:assert/strict";
import { test } from "node:test";

import { createFetchedContentStore } from "./content-store.ts";
import { createSearchResultStore } from "./search-store.ts";
import { registerWebSearchTool } from "./tools.ts";

type RegisteredTool = {
  name: string;
  description?: string;
  promptSnippet?: string;
  promptGuidelines?: string[];
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

  assert.deepEqual(tools.map((tool) => tool.name), ["web_search", "fetch_content", "get_search_content", "web_research"]);
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
  assert.deepEqual(tools[2]?.parameters.required, ["responseId"]);
  assert.ok(tools[2]?.parameters.properties?.responseId);
  assert.ok(tools[2]?.parameters.properties?.offset);
  assert.ok(tools[2]?.parameters.properties?.limit);
  assert.deepEqual(tools[3]?.parameters.required, ["question"]);
  assert.ok(tools[3]?.parameters.properties?.question);
  assert.ok(tools[3]?.parameters.properties?.maxSources);
  assert.ok(tools[3]?.parameters.properties?.maxCharsPerSource);
  assert.ok(tools[3]?.parameters.properties?.domainFilter);
});

test("registered tools guide the LLM to handle retrieval plumbing internally", () => {
  const tools: RegisteredTool[] = [];
  const pi = {
    registerTool(tool: unknown) {
      tools.push(tool as RegisteredTool);
    },
  } as Parameters<typeof registerWebSearchTool>[0];

  registerWebSearchTool(pi);

  const webSearchGuidance = tools.find((tool) => tool.name === "web_search")?.promptGuidelines?.join("\n") ?? "";
  const fetchGuidance = tools.find((tool) => tool.name === "fetch_content")?.promptGuidelines?.join("\n") ?? "";
  const getGuidance = tools.find((tool) => tool.name === "get_search_content")?.promptGuidelines?.join("\n") ?? "";
  const researchGuidance = tools.find((tool) => tool.name === "web_research")?.promptGuidelines?.join("\n") ?? "";

  assert.match(webSearchGuidance, /search first, then fetch/i);
  assert.match(webSearchGuidance, /natural-language/i);
  assert.match(fetchGuidance, /automatically call get_search_content/i);
  assert.match(fetchGuidance, /Do not ask the user to provide responseId or offset/i);
  assert.match(getGuidance, /continuation requests/i);
  assert.match(getGuidance, /Do not require the user to know responseId or offset/i);
  assert.match(researchGuidance, /Prefer this tool for natural-language research/i);
  assert.match(researchGuidance, /search and source reading/i);
});

test("web_research searches, fetches top sources, stores content, and returns evidence", async () => {
  const tools: RegisteredTool[] = [];
  const pi = {
    registerTool(tool: unknown) {
      tools.push(tool as RegisteredTool);
    },
  } as Parameters<typeof registerWebSearchTool>[0];
  const searched: Array<{ query: string; count?: number }> = [];
  const fetched: string[] = [];

  registerWebSearchTool(pi, {
    store: createSearchResultStore(),
    contentStore: createFetchedContentStore(),
    search: async (options) => {
      searched.push({ query: options.query, count: options.count });
      return {
        query: options.query,
        authRoute: "openai-codex",
        answer: "Use official docs for custom tools.",
        sources: [
          { title: "Extensions", url: "https://docs.example.com/extensions", snippet: "tools" },
          { title: "Other", url: "https://docs.example.com/other", snippet: "other" },
        ],
      };
    },
    fetch: async (options) => {
      fetched.push(options.url);
      return {
        url: options.url,
        finalUrl: options.url,
        title: options.url.endsWith("extensions") ? "Extensions" : "Other",
        contentType: "text/html",
        content: options.url.endsWith("extensions") ? "Extension content excerpt" : "Other content excerpt",
        fullContent: options.url.endsWith("extensions") ? "Extension content excerpt full" : "Other content excerpt full",
        truncated: false,
      };
    },
  });

  const researchTool = tools.find((tool) => tool.name === "web_research");
  assert.ok(researchTool);

  const result = await researchTool.execute("call-1", {
    question: "How do I write a pi custom tool?",
    maxSources: 1,
    maxCharsPerSource: 1000,
  }, undefined, undefined, undefined);

  assert.deepEqual(searched, [{ query: "How do I write a pi custom tool?", count: 1 }]);
  assert.deepEqual(fetched, ["https://docs.example.com/extensions"]);
  assert.match(result.content[0]?.text ?? "", /Question: How do I write a pi custom tool\?/);
  assert.match(result.content[0]?.text ?? "", /Search answer:/);
  assert.match(result.content[0]?.text ?? "", /Extension content excerpt/);
  assert.deepEqual(result.details, {
    question: "How do I write a pi custom tool?",
    searchResponseId: "ws_1",
    searchSourceCount: 2,
    fetchedSourceCount: 1,
    sources: [{
      id: "r1",
      title: "Extensions",
      url: "https://docs.example.com/extensions",
      fetchResponseId: "fc_1",
      charCount: 25,
      fullCharCount: 30,
      truncated: false,
    }],
  });
});

test("web_research records fetch errors and continues with other sources", async () => {
  const tools: RegisteredTool[] = [];
  const pi = {
    registerTool(tool: unknown) {
      tools.push(tool as RegisteredTool);
    },
  } as Parameters<typeof registerWebSearchTool>[0];

  registerWebSearchTool(pi, {
    store: createSearchResultStore(),
    contentStore: createFetchedContentStore(),
    search: async (options) => ({
      query: options.query,
      authRoute: "openai-codex",
      answer: "Two sources found.",
      sources: [
        { title: "Broken", url: "https://broken.example.com", snippet: "broken" },
        { title: "Working", url: "https://working.example.com", snippet: "working" },
      ],
    }),
    fetch: async (options) => {
      if (options.url.includes("broken")) throw new Error("HTTP 500");
      return {
        url: options.url,
        finalUrl: options.url,
        title: "Working",
        contentType: "text/plain",
        content: "Working excerpt",
        fullContent: "Working excerpt full",
        truncated: false,
      };
    },
  });

  const researchTool = tools.find((tool) => tool.name === "web_research");
  assert.ok(researchTool);

  const result = await researchTool.execute("call-1", { question: "compare sources", maxSources: 2 }, undefined, undefined, undefined);
  assert.match(result.content[0]?.text ?? "", /Fetch error: HTTP 500/);
  assert.match(result.content[0]?.text ?? "", /Working excerpt/);
  assert.equal(result.details.fetchedSourceCount, 1);
  assert.deepEqual((result.details.sources as Array<{ error?: string; fetchResponseId?: string }>).map((source) => source.error ?? source.fetchResponseId), ["HTTP 500", "fc_1"]);
});

test("fetch_content stores full content and get_search_content retrieves chunks", async () => {
  const tools: RegisteredTool[] = [];
  const pi = {
    registerTool(tool: unknown) {
      tools.push(tool as RegisteredTool);
    },
  } as Parameters<typeof registerWebSearchTool>[0];

  registerWebSearchTool(pi, {
    contentStore: createFetchedContentStore(),
    fetch: async (options) => ({
      url: options.url,
      finalUrl: options.url,
      title: "Long Page",
      contentType: "text/plain",
      content: "0123456789",
      fullContent: "0123456789abcdefghijklmnopqrstuvwxyz",
      truncated: true,
    }),
  });

  const fetchTool = tools.find((tool) => tool.name === "fetch_content");
  const getTool = tools.find((tool) => tool.name === "get_search_content");
  assert.ok(fetchTool);
  assert.ok(getTool);

  const fetchResult = await fetchTool.execute("call-1", { url: "https://example.com", maxChars: 10 }, undefined, undefined, undefined);
  assert.equal(fetchResult.details.responseId, "fc_1");
  assert.equal(fetchResult.details.fullCharCount, 36);
  assert.match(fetchResult.content[0]?.text ?? "", /responseId: fc_1/);
  assert.match(fetchResult.content[0]?.text ?? "", /Full chars: 36/);
  assert.match(fetchResult.content[0]?.text ?? "", /Use get_search_content\({ responseId: "fc_1"/);

  const chunk = await getTool.execute("call-2", { responseId: "fc_1", offset: 10, limit: 5 }, undefined, undefined, undefined);
  assert.match(chunk.content[0]?.text ?? "", /responseId: fc_1/);
  assert.match(chunk.content[0]?.text ?? "", /Offset: 10/);
  assert.match(chunk.content[0]?.text ?? "", /Limit: 5/);
  assert.match(chunk.content[0]?.text ?? "", /Full chars: 36/);
  assert.match(chunk.content[0]?.text ?? "", /Next offset: 15/);
  assert.match(chunk.content[0]?.text ?? "", /\n---\nabcde$/);
  assert.deepEqual(chunk.details, {
    responseId: "fc_1",
    url: "https://example.com",
    finalUrl: "https://example.com",
    title: "Long Page",
    contentType: "text/plain",
    offset: 10,
    limit: 5,
    charCount: 5,
    fullCharCount: 36,
    nextOffset: 15,
    truncated: true,
  });
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
        fullContent: "Docs body",
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
  assert.equal(fetchResult.details.responseId, "fc_1");
  assert.match(fetchResult.content[0]?.text ?? "", /responseId: fc_1/);
  assert.match(fetchResult.content[0]?.text ?? "", /Full chars: 9/);
});
