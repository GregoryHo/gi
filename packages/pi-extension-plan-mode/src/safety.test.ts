import assert from "node:assert/strict";
import test from "node:test";

import { getPlanModeToolNames, isReadOnlyBashCommand } from "./safety.ts";

test("plan mode tools preserve unrelated tools while removing write tools", () => {
  assert.deepEqual(getPlanModeToolNames(["read", "edit", "custom_tool", "write"]), [
    "read",
    "custom_tool",
    "bash",
    "grep",
    "find",
    "ls",
  ]);
});

test("read-only bash commands are allowed", () => {
	for (const command of [
		"pwd",
		"ls -la",
		"rg plan",
		"git status --short",
		"git status --short --branch",
		"git branch --show-current",
		"git diff -- src/index.ts",
	]) {
		assert.equal(isReadOnlyBashCommand(command), true, command);
	}
});

test("safe read-only command chains are allowed", () => {
	for (const command of ["git status --short --branch && git branch --show-current", "pwd; git status --short"]) {
		assert.equal(isReadOnlyBashCommand(command), true, command);
	}
});

test("unsafe bash commands are blocked", () => {
	for (const command of ["rm -rf tmp", "git commit -m test", "npm install", "echo hello > file.txt", "git branch fix/test"]) {
		assert.equal(isReadOnlyBashCommand(command), false, command);
	}
});

test("unsafe or ambiguous compound bash commands are blocked", () => {
	for (const command of ["ls && rm x", "git status && git branch fix/test", "rg foo | tee out.txt"]) {
		assert.equal(isReadOnlyBashCommand(command), false, command);
	}
});
