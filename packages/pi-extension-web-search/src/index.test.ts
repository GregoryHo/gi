import assert from "node:assert/strict";
import { test } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import webSearch from "./index.ts";

test("webSearch extension registers tools and the doctor command", () => {
  const toolNames: string[] = [];
  const commandNames: string[] = [];
  webSearch({
    registerTool(tool: { name: string }) {
      toolNames.push(tool.name);
    },
    registerCommand(name: string) {
      commandNames.push(name);
    },
  } as unknown as ExtensionAPI);

  assert.deepEqual(toolNames, ["web_research", "web_search", "fetch_content", "get_search_content"]);
  assert.deepEqual(commandNames, ["web-search-doctor"]);
});
