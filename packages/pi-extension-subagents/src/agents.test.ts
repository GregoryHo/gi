import assert from "node:assert/strict";
import test from "node:test";

import { getSubagentDefinition, listSubagentDefinitions } from "./agents.ts";

test("built-in subagent definitions are read-only and bounded", () => {
	const agents = listSubagentDefinitions();
	assert.deepEqual(agents.map((agent) => agent.name), ["explorer", "planner", "reviewer"]);
	for (const agent of agents) {
		assert.equal(agent.readOnly, true);
		assert.equal(agent.maxTurns, 8);
		assert.equal(agent.timeoutMs, 120_000);
		assert.match(agent.systemPrompt, /do not modify/i);
	}
	assert.equal(getSubagentDefinition("unknown"), undefined);
});
