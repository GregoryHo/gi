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
  for (const command of ["pwd", "ls -la", "rg plan", "git status --short", "git diff -- src/index.ts"]) {
    assert.equal(isReadOnlyBashCommand(command), true, command);
  }
});

test("unsafe bash commands are blocked", () => {
  for (const command of ["rm -rf tmp", "git commit -m test", "npm install", "echo hello > file.txt"]) {
    assert.equal(isReadOnlyBashCommand(command), false, command);
  }
});

test("ambiguous compound bash commands are blocked", () => {
  for (const command of ["ls && rm x", "pwd; git status", "rg foo | tee out.txt"]) {
    assert.equal(isReadOnlyBashCommand(command), false, command);
  }
});
