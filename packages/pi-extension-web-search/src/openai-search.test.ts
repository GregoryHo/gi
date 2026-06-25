import assert from "node:assert/strict";
import { test } from "node:test";

import { OPENAI_RESPONSES_URL, searchWithOpenAI } from "./openai-search.ts";

test("searchWithOpenAI reports actionable auth guidance without leaking secrets", async () => {
  await assert.rejects(
    () => searchWithOpenAI({
      query: "pi web search",
      resolveAuth: async () => undefined,
      fetchImpl: async () => { throw new Error("fetch should not be called"); },
    }),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /OpenAI web search unavailable/);
      assert.match(error.message, /OPENAI_API_KEY/);
      assert.doesNotMatch(error.message, /sk-|Bearer|cookie/i);
      return true;
    },
  );
});

test("searchWithOpenAI posts a required web_search request and parses citations", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];

  const result = await searchWithOpenAI({
    query: "pi extension docs",
    count: 2,
    domainFilter: ["docs.example.com"],
    resolveAuth: async () => ({
      route: "openai-api-key",
      provider: "openai",
      apiKey: "sk-test-secret",
      model: "gpt-4.1-mini",
      headers: { "x-extra": "1" },
    }),
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({
        output: [{
          type: "message",
          content: [{
            text: "Use pi extension docs.",
            annotations: [{
              type: "url_citation",
              url: "https://docs.example.com/extensions",
              title: "Extensions",
            }],
          }],
        }],
      }), { status: 200 });
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, OPENAI_RESPONSES_URL);
  const headers = calls[0]?.init.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer sk-test-secret");
  assert.equal(headers["OpenAI-Beta"], "responses=experimental");

  const body = JSON.parse(String(calls[0]?.init.body));
  assert.equal(body.tool_choice, "required");
  assert.equal(body.store, false);
  assert.equal(body.tools[0].type, "web_search");
  assert.deepEqual(body.tools[0].filters.allowed_domains, ["docs.example.com"]);

  assert.equal(result.authRoute, "openai-api-key");
  assert.equal(result.answer, "Use pi extension docs.");
  assert.deepEqual(result.sources.map((source) => source.url), ["https://docs.example.com/extensions"]);
});
