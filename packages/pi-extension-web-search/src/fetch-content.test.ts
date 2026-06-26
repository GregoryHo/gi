import assert from "node:assert/strict";
import { test } from "node:test";

import { extractFetchedContent, fetchContent, formatFetchContentResult, normalizeFetchParams } from "./fetch-content.ts";

test("normalizeFetchParams accepts URL and clamps maxChars", () => {
  const params = normalizeFetchParams({ url: " https://example.com/docs ", maxChars: 100_000 });

  assert.equal(params.url, "https://example.com/docs");
  assert.equal(params.maxChars, 20_000);
});

test("extractFetchedContent converts HTML into compact markdown-ish text", async () => {
  const response = new Response(`<!doctype html>
    <html><head><title>Example Docs</title><script>secret()</script></head>
    <body>
      <h1>Getting Started</h1>
      <p>Install the package from <a href="/install">install docs</a>.</p>
      <ul><li>First step</li><li>Second step</li></ul>
    </body></html>`, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });

  const result = await extractFetchedContent(response, "https://example.com/guide", 2000);

  assert.equal(result.title, "Example Docs");
  assert.match(result.content, /# Getting Started/);
  assert.match(result.content, /Install the package from \[install docs\]\(https:\/\/example.com\/install\)\./);
  assert.match(result.content, /- First step/);
  assert.doesNotMatch(result.content, /secret/);
  assert.equal(result.truncated, false);
});

test("extractFetchedContent handles JSON and truncates by maxChars", async () => {
  const response = new Response(JSON.stringify({ ok: true, message: "hello world" }), {
    headers: { "content-type": "application/json" },
  });

  const result = await extractFetchedContent(response, "https://api.example.com/data", 20);

  assert.equal(result.contentType, "application/json");
  assert.equal(result.truncated, true);
  assert.equal(result.content.length, 20);
  assert.equal(result.fullContent, JSON.stringify({ ok: true, message: "hello world" }));
});

test("fetchContent returns final URL details and compact content", async () => {
  const result = await fetchContent({
    url: "https://example.com/page",
    maxChars: 1000,
    lookup: async () => [{ address: "93.184.216.34", family: 4 }],
    fetchImpl: async () => new Response("plain content", {
      headers: { "content-type": "text/plain" },
    }),
  });

  assert.equal(result.url, "https://example.com/page");
  assert.equal(result.finalUrl, "https://example.com/page");
  assert.equal(result.content, "plain content");
  assert.equal(result.contentType, "text/plain");
});

test("formatFetchContentResult returns bounded safe tool output", () => {
  const formatted = formatFetchContentResult({
    url: "https://example.com/page",
    finalUrl: "https://example.com/page",
    title: "Example Page",
    contentType: "text/html",
    content: "# Example\n\nBody",
    fullContent: "# Example\n\nBody",
    truncated: false,
  });

  assert.match(formatted.content[0]?.text ?? "", /Untrusted web content/);
  assert.match(formatted.content[0]?.text ?? "", /Example Page/);
  assert.deepEqual(formatted.details, {
    url: "https://example.com/page",
    finalUrl: "https://example.com/page",
    title: "Example Page",
    contentType: "text/html",
    charCount: 15,
    truncated: false,
  });
  assert.doesNotMatch(JSON.stringify(formatted), /cookie|authorization|bearer|sk-/i);
});
