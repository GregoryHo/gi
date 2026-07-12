import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("five-extension command and tool contracts coexist with compatibility aliases", async () => {
	const [plan, goal, workers, subagents, web] = await Promise.all([
		read("packages/pi-extension-plan-mode/src/index.ts"),
		read("packages/pi-extension-goal-mode/src/commands.ts"),
		read("packages/pi-extension-agent-workers/src/commands/index.ts"),
		read("packages/pi-extension-subagents/src/index.ts"),
		read("packages/pi-extension-web-search/src/tools.ts"),
	]);

	assert.match(plan, /registerCommand\("plan"/);
	assert.match(plan, /registerCommand\("plan-current"/);
	assert.match(goal, /registerCommand\("goal"/);
	assert.match(goal, /registerLifecycleCommand\("goal-status"/);
	assert.match(workers, /registerCommand\("worker"/);
	assert.match(workers, /registerLegacyCommand\("worker-status"/);
	assert.match(subagents, /name: "subagent"/);
	for (const tool of ["web_research", "web_search", "fetch_content", "get_search_content"]) {
		assert.match(web, new RegExp(`name: "${tool}"`));
	}
});

test("cross-extension safety and model-visible output budgets remain explicit", async () => {
	const [planSafety, webSsrf, webTools, workerTools, subagents] = await Promise.all([
		read("packages/pi-extension-plan-mode/src/safety.ts"),
		read("packages/pi-extension-web-search/src/ssrf.ts"),
		read("packages/pi-extension-web-search/src/tools.ts"),
		read("packages/pi-extension-agent-workers/src/tools/index.ts"),
		read("packages/pi-extension-subagents/src/index.ts"),
	]);

	assert.match(planSafety, /PLAN_MODE_REVIEWED_TOOLS/);
	assert.match(planSafety, /"web_research"/);
	assert.match(planSafety, /"subagent"/);
	assert.match(webSsrf, /URL credentials are not allowed/);
	assert.match(webSsrf, /lookup: \(_hostname, lookupOptions, callback\)/);
	assert.match(webTools, /MAX_WEB_RESEARCH_OUTPUT_CHARS = 40_000/);
	assert.match(workerTools, /formatWorkerModelResult/);
	assert.match(subagents, /formatSubagentResults/);
});
