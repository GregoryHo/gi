import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildOpenAIRequestBody,
  formatSearchToolResult,
  normalizeSearchParams,
  parseOpenAIResponseText,
} from "./results.ts";

test("normalizeSearchParams trims query, clamps count, and normalizes domain filters", () => {
  const params = normalizeSearchParams({
    query: "  pi coding agent  ",
    count: 50,
    domainFilter: ["https://docs.example.com/path", "-spam.example", "bad host", "docs.example.com"],
  });

  assert.equal(params.query, "pi coding agent");
  assert.equal(params.count, 10);
  assert.deepEqual(params.domainFilters, {
    allowedDomains: ["docs.example.com"],
    blockedDomains: ["spam.example"],
  });
});

test("buildOpenAIRequestBody requires web_search and includes domain filters without secrets", () => {
  const body = buildOpenAIRequestBody({
    model: "gpt-4.1-mini",
    query: "typescript release notes",
    count: 3,
    domainFilters: {
      allowedDomains: ["typescriptlang.org"],
      blockedDomains: ["example.com"],
    },
  });

  assert.equal(body.model, "gpt-4.1-mini");
  assert.equal(body.store, false);
  assert.equal(body.tool_choice, "required");
  assert.deepEqual(body.tools, [{
    type: "web_search",
    filters: {
      allowed_domains: ["typescriptlang.org"],
      blocked_domains: ["example.com"],
    },
  }]);
  assert.deepEqual(body.include, ["web_search_call.action.sources"]);
  assert.match(body.instructions, /Prefer around 3 distinct sources/);
  assert.doesNotMatch(JSON.stringify(body), /sk-|Bearer|cookie/i);
});

test("parseOpenAIResponseText extracts answer and URL citations from JSON output", () => {
  const parsed = parseOpenAIResponseText(JSON.stringify({
    output: [{
      type: "message",
      content: [{
        type: "output_text",
        text: "Pi supports extensions with custom tools.",
        annotations: [{
          type: "url_citation",
          url: "https://docs.example.com/pi?utm_source=openai",
          title: "Pi extension docs",
          start_index: 12,
          end_index: 22,
        }],
      }],
    }],
  }), 5);

  assert.equal(parsed.answer, "Pi supports extensions with custom tools.");
  assert.deepEqual(parsed.sources, [{
    title: "Pi extension docs",
    url: "https://docs.example.com/pi",
    snippet: "Pi supports extensions with custom tools.",
  }]);
});

test("parseOpenAIResponseText handles streamed SSE web_search sources and deduplicates", () => {
  const sse = [
    "data: {\"type\":\"response.output_item.done\",\"item\":{\"type\":\"web_search_call\",\"action\":{\"sources\":[{\"url\":\"https://a.example\",\"title\":\"A\"},{\"url\":\"https://a.example\",\"title\":\"A duplicate\"},{\"source_website_url\":\"https://b.example\",\"caption\":\"B\"}]}}}",
    "data: {\"type\":\"response.output_item.done\",\"item\":{\"type\":\"message\",\"content\":[{\"text\":\"Answer from stream.\"}]}}",
    "data: [DONE]",
  ].join("\n");

  const parsed = parseOpenAIResponseText(sse, 2);

  assert.equal(parsed.answer, "Answer from stream.");
  assert.deepEqual(parsed.sources.map((source) => source.url), ["https://a.example/", "https://b.example/"]);
});

test("formatSearchToolResult returns compact text, response id, source ids, and safe details", () => {
  const result = formatSearchToolResult({
    query: "pi web search",
    authRoute: "openai-codex",
    responseId: "ws_1",
    answer: "Pi can search the web through a tool.",
    sources: [{ id: "r1", title: "Docs", url: "https://docs.example.com", snippet: "" }],
  });

  assert.match(result.content[0]?.text ?? "", /Pi can search the web/);
  assert.match(result.content[0]?.text ?? "", /responseId: ws_1/);
  assert.match(result.content[0]?.text ?? "", /\[r1\] Docs/);
  assert.deepEqual(result.details, {
    provider: "openai",
    authRoute: "openai-codex",
    responseId: "ws_1",
    query: "pi web search",
    sourceCount: 1,
    sources: [{ id: "r1", title: "Docs", url: "https://docs.example.com", snippet: "" }],
  });
  assert.doesNotMatch(JSON.stringify(result), /sk-|Bearer|cookie/i);
});
