import { spawnSync } from "node:child_process";

const packages = [
	"pi-extension-plan-mode",
	"pi-extension-goal-mode",
	"pi-extension-web-search",
	"pi-extension-agent-workers",
	"pi-extension-subagents",
];

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

run("npm ci --dry-run --ignore-scripts", npm, ["ci", "--dry-run", "--ignore-scripts"]);
for (const packageName of packages) {
	for (const script of ["test", "typecheck", "pack:dry-run"]) {
		run(`npm run ${script} --workspace @gregho/${packageName}`, npm, ["run", script, "--workspace", `@gregho/${packageName}`]);
	}
}
run("npm run typecheck", npm, ["run", "typecheck"]);
run("npm run test:tools", npm, ["run", "test:tools"]);
run("npm run style:audit", npm, ["run", "style:audit"]);
run(
	"pi --no-extensions --offline --no-session all-five load and web-search-doctor smoke",
	"pi",
	[
		"--no-extensions",
		"--offline",
		"--no-session",
		"-e", "./packages/pi-extension-plan-mode",
		"-e", "./packages/pi-extension-goal-mode",
		"-e", "./packages/pi-extension-web-search",
		"-e", "./packages/pi-extension-agent-workers",
		"-e", "./packages/pi-extension-subagents",
		"-p", "/web-search-doctor",
	],
);
run("git diff --check", "git", ["diff", "--check"]);

function run(label, command, args) {
	console.log(`\n> ${label}`);
	const result = spawnSync(command, args, { stdio: "inherit" });
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
}
