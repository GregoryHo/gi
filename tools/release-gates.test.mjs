import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const targetPackages = [
	"pi-extension-plan-mode",
	"pi-extension-goal-mode",
	"pi-extension-web-search",
	"pi-extension-agent-workers",
	"pi-extension-subagents",
];

test("release verification is runnable locally and in CI without publishing or tagging", async () => {
	const [manifestText, runnerText, workflowText] = await Promise.all([
		readFile(new URL("../package.json", import.meta.url), "utf8"),
		readFile(new URL("../tools/release-gates.mjs", import.meta.url), "utf8"),
		readFile(new URL("../.github/workflows/verify.yml", import.meta.url), "utf8"),
	]);
	const manifest = JSON.parse(manifestText);

	assert.equal(manifest.scripts["verify:release"], "node tools/release-gates.mjs");
	for (const packageName of targetPackages) {
		assert.match(runnerText, new RegExp(`"${packageName}"`));
	}
	assert.match(runnerText, /@gregho\/\$\{packageName\}/);
	for (const gate of ["npm ci --dry-run --ignore-scripts", "npm run typecheck", "npm run test:tools", "npm run style:audit", "git diff --check"]) {
		assert.match(runnerText, new RegExp(gate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
	}
	assert.match(runnerText, /--offline/);
	assert.match(runnerText, /--no-session/);
	assert.match(runnerText, /web-search-doctor/);
	assert.match(workflowText, /npm run verify:release/);
	assert.doesNotMatch(runnerText, /npm publish|git tag|git push/);
	assert.doesNotMatch(workflowText, /npm publish|git tag|git push/);
	assert.ok(root.pathname);
});
