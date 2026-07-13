import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = new URL("..", import.meta.url);
const packageNames = [
	"pi-extension-plan-mode",
	"pi-extension-goal-mode",
	"pi-extension-web-search",
	"pi-extension-agent-workers",
	"pi-extension-subagents",
];

for (const packageName of packageNames) {
	test(`${packageName} has distributable release metadata`, async () => {
		const packageDir = new URL(`../packages/${packageName}/`, import.meta.url);
		const manifest = JSON.parse(await readFile(new URL("package.json", packageDir), "utf8"));

		assert.equal(manifest.license, "MIT");
		assert.equal(manifest.author, "GregoryHo");
		assert.deepEqual(manifest.repository, {
			type: "git",
			url: "git+https://github.com/GregoryHo/gi.git",
			directory: `packages/${packageName}`,
		});
		assert.deepEqual(manifest.bugs, { url: "https://github.com/GregoryHo/gi/issues" });
		assert.equal(manifest.homepage, `https://github.com/GregoryHo/gi/tree/main/packages/${packageName}#readme`);
		await access(join(root.pathname, "packages", packageName, "LICENSE"));
	});
}

test("root README indexes every release-ready extension package", async () => {
	const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

	for (const packageName of packageNames) {
		assert.match(readme, new RegExp(`packages/${packageName}`));
	}
});
