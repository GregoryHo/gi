import assert from "node:assert/strict";
import { test } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import webSearch from "./index.ts";

test("webSearch extension registers web_search and fetch_content tools", () => {
  const toolNames: string[] = [];
  webSearch({
    registerTool(tool: { name: string }) {
      toolNames.push(tool.name);
    },
  } as unknown as ExtensionAPI);

  assert.deepEqual(toolNames, ["web_search", "fetch_content"]);
});
