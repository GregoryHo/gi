import assert from "node:assert/strict";
import { test } from "node:test";

import { createSearchResultStore } from "./search-store.ts";

test("search result store assigns response and per-result ids", () => {
  const store = createSearchResultStore();
  const stored = store.save({
    query: "pi web search",
    sources: [
      { title: "First", url: "https://example.com/first", snippet: "one" },
      { title: "Second", url: "https://example.com/second", snippet: "two" },
    ],
  });

  assert.equal(stored.responseId, "ws_1");
  assert.deepEqual(stored.sources.map((source) => source.id), ["r1", "r2"]);
  assert.equal(stored.sources[1]?.url, "https://example.com/second");
});

test("search result store resolves by result id or 1-based index", () => {
  const store = createSearchResultStore();
  const stored = store.save({
    query: "pi web search",
    sources: [
      { title: "First", url: "https://example.com/first", snippet: "one" },
      { title: "Second", url: "https://example.com/second", snippet: "two" },
    ],
  });

  assert.equal(store.resolve({ responseId: stored.responseId, resultId: "r2" }).url, "https://example.com/second");
  assert.equal(store.resolve({ responseId: stored.responseId, index: 1 }).url, "https://example.com/first");
});

test("search result store gives actionable errors for unknown ids", () => {
  const store = createSearchResultStore();
  const stored = store.save({
    query: "pi web search",
    sources: [{ title: "First", url: "https://example.com/first", snippet: "one" }],
  });

  assert.throws(() => store.resolve({ responseId: "missing", resultId: "r1" }), /Unknown web_search responseId: missing/);
  assert.throws(() => store.resolve({ responseId: stored.responseId, resultId: "r9" }), /Unknown web_search resultId: r9/);
  assert.throws(() => store.resolve({ responseId: stored.responseId, index: 9 }), /Unknown web_search result index: 9/);
});
