import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { auditPackage } from "./extension-style-audit.mjs";

test("auditPackage classifies a large package and reports mechanical style signals", async () => {
  const root = await mkdtemp(join(tmpdir(), "extension-style-audit-"));
  try {
    const packageDir = join(root, "packages", "pi-extension-example");
    const srcDir = join(packageDir, "src");
    await mkdir(srcDir, { recursive: true });
    await writeFile(
      join(packageDir, "package.json"),
      JSON.stringify({
        name: "@example/pi-extension-example",
        type: "module",
        main: "src/index.ts",
        exports: { ".": { import: "./src/index.ts", types: "./src/index.ts" } },
        keywords: ["pi-package", "pi-extension"],
        pi: { extensions: ["./src/index.ts"] },
        scripts: { test: "node --test", typecheck: "tsc --noEmit", "pack:dry-run": "npm pack --dry-run" },
        peerDependencies: { "@earendil-works/pi-coding-agent": "*", typebox: "*" },
      }),
      "utf8",
    );
    await writeFile(
      join(srcDir, "index.ts"),
      "export default function extension(pi) {\npi.registerCommand('one', {});\npi.registerCommand('two', {});\npi.registerTool({ name: 'tool', parameters: Type.Object({ mode: Type.Union([Type.Literal('a'), Type.Literal('b')]) }) });\n}\n",
      "utf8",
    );
    await mkdir(join(srcDir, "adapters"), { recursive: true });
    for (const name of ["claude.ts", "codex.ts", "demo.ts"]) {
      await writeFile(join(srcDir, "adapters", name), "export const adapter = true;\n", "utf8");
    }
    for (const name of [
      "jira-users.ts",
      "jira-boards.ts",
      "jira-sprints.ts",
      "jira-client.ts",
      "jira-ui.ts",
      "browser-capture.ts",
      "recording-proxy.ts",
      "artifacts.ts",
      "config.ts",
      "types.ts",
      "tools.ts",
      "commands.ts",
      "state.ts",
      "mapper.ts",
      "validator.ts",
      "widget.ts",
    ]) {
      await writeFile(join(srcDir, name), "export const value = true;\n", "utf8");
    }

    const result = await auditPackage(packageDir);

    assert.equal(result.packageName, "@example/pi-extension-example");
    assert.equal(result.classification, "large");
    assert.equal(result.productionFileCount, 20);
    assert.ok(result.indexRegistrations.commands >= 2);
    assert.ok(result.indexRegistrations.tools >= 1);
    assert.equal(result.stringEnumLiteralUnionFiles.length, 1);
    assert.ok(result.promotionSignals.some((signal) => signal.includes("jira")));
    assert.ok(result.promotionSignals.some((signal) => signal.includes("adapters/")));
    assert.deepEqual(result.manifestIssues, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
