import assert from "node:assert/strict";
import { test } from "node:test";

import { extractHtmlContent } from "./html-extract.ts";

test("extractHtmlContent uses Defuddle with local-only markdown extraction", async () => {
  let observedUrl = "";
  let observedOptions: Record<string, unknown> | null = null;

  const result = await extractHtmlContent(
    "<html><head><title>Raw Title</title></head><body><nav>Nav</nav><article><h1>Article</h1><p>Body</p></article></body></html>",
    "https://example.com/article",
    {
      defuddle: async (_document, url, options) => {
        observedUrl = url;
        observedOptions = options as Record<string, unknown>;
        return { title: "Clean Title", content: "# Article\n\nBody" };
      },
    },
  );

  assert.equal(observedUrl, "https://example.com/article");
  assert.deepEqual(observedOptions, { markdown: true, useAsync: false });
  assert.deepEqual(result, { title: "Clean Title", content: "# Article\n\nBody", extractor: "defuddle" });
});

test("extractHtmlContent falls back to simple extraction when Defuddle fails", async () => {
  const result = await extractHtmlContent(
    "<html><head><title>Fallback Title</title></head><body><h1>Hello</h1><p>Fallback body <a href='/next'>next</a>.</p></body></html>",
    "https://example.com/base/page",
    {
      defuddle: async () => {
        throw new Error("defuddle failed");
      },
    },
  );

  assert.equal(result.extractor, "simple");
  assert.equal(result.title, "Fallback Title");
  assert.match(result.content, /# Hello/);
  assert.match(result.content, /\[next\]\(https:\/\/example.com\/next\)/);
});

test("extractHtmlContent falls back to simple extraction when Defuddle returns empty content", async () => {
  const result = await extractHtmlContent(
    "<html><head><title>Empty Defuddle</title></head><body><p>Simple content</p></body></html>",
    "https://example.com/page",
    {
      defuddle: async () => ({ title: "", content: "   " }),
    },
  );

  assert.equal(result.extractor, "simple");
  assert.equal(result.title, "Empty Defuddle");
  assert.equal(result.content, "Simple content");
});
