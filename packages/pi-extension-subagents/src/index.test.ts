import assert from "node:assert/strict";
import test from "node:test";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import subagentsExtension from "./index.ts";

test("subagents extension registers one bounded foreground tool", () => {
	const tools: Array<Record<string, unknown>> = [];
	const pi = {
		registerTool(tool: Record<string, unknown>) {
			tools.push(tool);
		},
	} as unknown as ExtensionAPI;

	subagentsExtension(pi);

	assert.equal(tools.length, 1);
	assert.equal(tools[0]?.name, "subagent");
	assert.match(String(tools[0]?.description), /foreground/i);
	assert.equal(typeof tools[0]?.execute, "function");
});
