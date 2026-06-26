import assert from "node:assert/strict";
import { test } from "node:test";

import { createFetchedContentStore } from "./content-store.ts";

test("fetched content store saves content and returns bounded chunks", () => {
  const store = createFetchedContentStore();
  const stored = store.save({
    url: "https://example.com/page",
    finalUrl: "https://example.com/page",
    title: "Example",
    contentType: "text/html",
    content: "abcdefghijklmnopqrstuvwxyz",
  });

  assert.equal(stored.responseId, "fc_1");

  const first = store.getChunk({ responseId: stored.responseId, offset: 0, limit: 10 });
  assert.deepEqual(first, {
    responseId: "fc_1",
    url: "https://example.com/page",
    finalUrl: "https://example.com/page",
    title: "Example",
    contentType: "text/html",
    content: "abcdefghij",
    offset: 0,
    limit: 10,
    charCount: 10,
    fullCharCount: 26,
    nextOffset: 10,
    truncated: true,
  });

  const last = store.getChunk({ responseId: stored.responseId, offset: 20, limit: 10 });
  assert.equal(last.content, "uvwxyz");
  assert.equal(last.nextOffset, null);
  assert.equal(last.truncated, false);
});

test("fetched content store clamps offset and limit", () => {
  const store = createFetchedContentStore();
  const stored = store.save({
    url: "https://example.com/page",
    finalUrl: "https://example.com/page",
    title: "Example",
    contentType: "text/plain",
    content: "hello world",
  });

  const chunk = store.getChunk({ responseId: stored.responseId, offset: -10, limit: 100_000 });
  assert.equal(chunk.offset, 0);
  assert.equal(chunk.limit, 20_000);
  assert.equal(chunk.content, "hello world");
});

test("fetched content store gives actionable unknown response errors", () => {
  const store = createFetchedContentStore();
  assert.throws(() => store.getChunk({ responseId: "missing" }), /Unknown fetch_content responseId: missing/);
});
