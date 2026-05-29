import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { saveEnvironmentProfile } from "./environment-profiles.ts";

import {
  getApiAuditSetupLines,
  getApiAuditStatusLines,
  registerApiAuditCommands,
  parseApiAuditCaptureArgs,
  parseApiAuditCommand,
  parseApiAuditDiscoverArgs,
  parseApiDiscoveryAnalyzeArgs,
  parseApiDiscoveryCreateArgs,
  parseApiDiscoveryOpenArgs,
  parseApiDiscoveryScenarioArgs,
  parseApiDiscoverySuggestArgs,
  parseApiDiscoveryValidateSuggestionArgs,
} from "./commands.ts";

test("registered profile command resolves default artifact dir from execution cwd", async () => {
  const { workspaceRoot, artifactDir, handler, widgets, ctx } = await setupWorkspaceCommand();

  await handler("profile show", ctx);

  assert.match(widgets.at(-1)?.join("\n") ?? "", /uat/);
  assert.match(widgets.at(-1)?.join("\n") ?? "", new RegExp(escapeRegExp(`${artifactDir}/config.local.json`)));
  assert.ok(workspaceRoot);
});

test("registered target capture command resolves profile config from execution cwd", async () => {
  const { handler, widgets, ctx } = await setupWorkspaceCommand();

  await handler("capture --scenario-id account-activity-basic --profile uat --target new", ctx);

  const text = widgets.at(-1)?.join("\n") ?? "";
  assert.match(text, /Target capture preparation/);
  assert.match(text, /Selected targets: new/);
});

async function setupWorkspaceCommand(): Promise<{
  workspaceRoot: string;
  artifactDir: string;
  handler: (args: string, ctx: unknown) => Promise<void>;
  widgets: string[][];
  ctx: unknown;
}> {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "api-audit-command-workspace-"));
  const artifactDir = join(workspaceRoot, ".pi-api-audit-runs");
  await saveEnvironmentProfile(artifactDir, "uat", {
    oldUrl: "http://localhost:8080",
    newUrl: "http://localhost:8008",
    oldTargetUrl: "http://127.0.0.1:19080",
    newTargetUrl: "http://127.0.0.1:19081",
  });
  await writeFile(join(artifactDir, "scenarios.local.json"), JSON.stringify(workspaceScenarioDictionary()), "utf8");

  let handler: ((args: string, ctx: unknown) => Promise<void>) | undefined;
  registerApiAuditCommands({
    registerCommand(name: string, definition: { handler: (args: string, ctx: unknown) => Promise<void> }) {
      if (name === "api-audit") handler = definition.handler;
    },
  } as never);
  assert.ok(handler);

  const widgets: string[][] = [];
  const ctx = {
    cwd: workspaceRoot,
    hasUI: true,
    ui: {
      setWidget: (_key: string, lines: string[]) => widgets.push(lines),
      notify: () => undefined,
      confirm: async () => true,
    },
  };
  return { workspaceRoot, artifactDir, handler, widgets, ctx };
}

function workspaceScenarioDictionary() {
  return {
    version: 1,
    scenarios: [
      {
        id: "account-activity-basic",
        feature: "Account activity",
        description: "查詢Account activity列表",
        type: "read-only",
        page: { oldPath: "/account/activity", newPath: "/account/activity" },
        browserApiAllowlist: { old: ["/apis/account/activity"], new: ["/gateway/apis/account/activity"] },
        upstreamApiCandidates: { old: ["/v1/account/activity"], new: ["/apis/account/activity"] },
      },
    ],
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("parseApiAuditCommand defaults to status", () => {
  assert.deepEqual(parseApiAuditCommand(""), { kind: "status" });
});

test("parseApiAuditCommand recognizes account-activity", () => {
  assert.deepEqual(parseApiAuditCommand("account-activity --old-url http://localhost:8080"), {
    kind: "account-activity",
    args: "account-activity --old-url http://localhost:8080",
  });
});

test("parseApiAuditCommand recognizes proxy", () => {
  assert.deepEqual(parseApiAuditCommand("proxy --side old --listen-port 18080 --target-url http://localhost:19080"), {
    kind: "proxy",
    args: "proxy --side old --listen-port 18080 --target-url http://localhost:19080",
  });
});

test("parseApiAuditCommand recognizes account-activity-upstream", () => {
  assert.deepEqual(parseApiAuditCommand("account-activity-upstream --old-url http://localhost:8080"), {
    kind: "account-activity-upstream",
    args: "account-activity-upstream --old-url http://localhost:8080",
  });
});

test("parseApiAuditCommand recognizes profile", () => {
  assert.deepEqual(parseApiAuditCommand("profile show"), {
    kind: "profile",
    args: "profile show",
  });
});

test("parseApiAuditCommand recognizes setup capture and discover", () => {
  assert.deepEqual(parseApiAuditCommand("setup"), { kind: "setup", args: "setup" });
  assert.deepEqual(parseApiAuditCommand("capture --scenario-id account-activity-basic --profile uat --target new"), {
    kind: "capture",
    args: "capture --scenario-id account-activity-basic --profile uat --target new",
  });
  assert.deepEqual(parseApiAuditCommand("discover --scenario-id forward-game+transfer --profile uat --target new"), {
    kind: "discover",
    args: "discover --scenario-id forward-game+transfer --profile uat --target new",
  });
});

test("parseApiAuditCaptureArgs parses target capture preparation flags", () => {
  assert.deepEqual(parseApiAuditCaptureArgs("capture --scenario-id account-activity-basic --profile uat --target new --group default"), {
    scenarioId: "account-activity-basic",
    profileName: "uat",
    targetIds: ["new"],
    groupName: "default",
    artifactDir: ".pi-api-audit-runs",
    run: false,
  });
});

test("parseApiAuditCaptureArgs parses target capture run flag", () => {
  assert.deepEqual(parseApiAuditCaptureArgs("capture --run --scenario-id account-activity-basic --profile uat"), {
    scenarioId: "account-activity-basic",
    profileName: "uat",
    artifactDir: ".pi-api-audit-runs",
    targetIds: [],
    run: true,
  });
});

test("parseApiAuditDiscoverArgs parses manual-assisted discovery flags", () => {
  assert.deepEqual(parseApiAuditDiscoverArgs("discover --run --scenario-id forward-game+transfer --profile uat --target new --candidate-page-path /game/forward"), {
    action: "capture",
    candidateScenarioId: "forward-game+transfer",
    profileName: "uat",
    artifactDir: ".pi-api-audit-runs",
    targetIds: ["new"],
    candidatePagePath: "/game/forward",
    browser: false,
    run: true,
  });
  assert.deepEqual(parseApiAuditDiscoverArgs("discover --run --session discovery-123"), {
    action: "capture",
    artifactDir: ".pi-api-audit-runs",
    targetIds: [],
    sessionId: "discovery-123",
    browser: false,
    run: true,
  });
});

test("parseApiAuditDiscoverArgs parses browser-assisted discovery capture", () => {
  assert.deepEqual(parseApiAuditDiscoverArgs("discover capture --browser --scenario-id account-activity-basic"), {
    action: "capture",
    candidateScenarioId: "account-activity-basic",
    artifactDir: ".pi-api-audit-runs",
    targetIds: [],
    browser: true,
    run: true,
  });
});

test("parseApiAuditDiscoverArgs parses persistent discovery lifecycle actions", () => {
  assert.deepEqual(parseApiAuditDiscoverArgs("discover start --profile uat --target new"), {
    action: "start",
    profileName: "uat",
    artifactDir: ".pi-api-audit-runs",
    targetIds: ["new"],
    browser: false,
    run: false,
  });
  assert.deepEqual(parseApiAuditDiscoverArgs("discover status"), {
    action: "status",
    artifactDir: ".pi-api-audit-runs",
    targetIds: [],
    browser: false,
    run: false,
  });
  assert.deepEqual(parseApiAuditDiscoverArgs("discover stop --session discovery-123"), {
    action: "stop",
    artifactDir: ".pi-api-audit-runs",
    targetIds: [],
    sessionId: "discovery-123",
    browser: false,
    run: false,
  });
});

test("parseApiDiscoveryValidateSuggestionArgs parses suggestion validation flags", () => {
  assert.deepEqual(parseApiDiscoveryValidateSuggestionArgs("--suggestion .pi-api-audit-runs/candidates/suggestion.json"), {
    suggestionPath: ".pi-api-audit-runs/candidates/suggestion.json",
  });
  assert.deepEqual(parseApiDiscoveryValidateSuggestionArgs("--suggestion suggestion.json --scenario-dictionary scenarios.json"), {
    suggestionPath: "suggestion.json",
    scenarioDictionaryPath: "scenarios.json",
  });
});

test("parseApiDiscoverySuggestArgs parses scenario suggestion flags", () => {
  assert.deepEqual(parseApiDiscoverySuggestArgs("--analysis .pi-api-audit-runs/analysis/comparison-1.json"), {
    analysisPath: ".pi-api-audit-runs/analysis/comparison-1.json",
  });
  assert.deepEqual(parseApiDiscoverySuggestArgs("--analysis analysis.json --artifact-dir tmp --scenario-dictionary scenarios.json"), {
    analysisPath: "analysis.json",
    artifactDir: "tmp",
    scenarioDictionaryPath: "scenarios.json",
  });
});

test("parseApiDiscoveryAnalyzeArgs parses comparison analysis flags", () => {
  assert.deepEqual(parseApiDiscoveryAnalyzeArgs("--comparison .pi-api-audit-runs/comparisons/comparison-1.json"), {
    comparisonPath: ".pi-api-audit-runs/comparisons/comparison-1.json",
  });
  assert.deepEqual(parseApiDiscoveryAnalyzeArgs("--comparison comparison.json --artifact-dir tmp --scenario-dictionary scenarios.json"), {
    comparisonPath: "comparison.json",
    artifactDir: "tmp",
    scenarioDictionaryPath: "scenarios.json",
  });
});

test("parseApiDiscoveryCreateArgs parses top-level discovery create flags", () => {
  assert.deepEqual(parseApiDiscoveryCreateArgs("--profile uat --target old --target new"), {
    profileName: "uat",
    artifactDir: ".pi-api-audit-runs",
    targetIds: ["old", "new"],
  });
  assert.deepEqual(parseApiDiscoveryCreateArgs("--profile uat --group default --artifact-dir tmp-runs"), {
    profileName: "uat",
    artifactDir: "tmp-runs",
    targetIds: [],
    groupName: "default",
  });
});

test("parseApiDiscoveryScenarioArgs parses a candidate scenario id", () => {
  assert.equal(parseApiDiscoveryScenarioArgs("forward-game-transfer"), "forward-game-transfer");
  assert.throws(() => parseApiDiscoveryScenarioArgs(""), /scenario id is required/);
});

test("parseApiDiscoveryOpenArgs parses target and optional page path", () => {
  assert.deepEqual(parseApiDiscoveryOpenArgs("old --page-path /account/activity"), {
    targetId: "old",
    candidatePagePath: "/account/activity",
  });
});

test("getApiAuditSetupLines gives widget-friendly setup guidance", () => {
  const lines = getApiAuditSetupLines();
  assert.ok(lines.some((line) => line.includes("/api-audit profile show")));
  assert.ok(lines.some((line) => line.includes("/api-audit capture")));
  assert.ok(lines.some((line) => line.includes("/api-audit discover")));
});

test("getApiAuditStatusLines mentions the M2 account-activity command", () => {
  const lines = getApiAuditStatusLines();
  assert.ok(lines.some((line) => line.includes("/api-audit account-activity")));
  assert.ok(lines.some((line) => line.includes("/api-audit proxy")));
  assert.ok(lines.some((line) => line.includes("/api-audit account-activity-upstream")));
  assert.ok(lines.some((line) => line.includes("/api-audit profile")));
  assert.ok(lines.some((line) => line.includes("/api-audit setup")));
  assert.ok(lines.some((line) => line.includes("/api-audit capture")));
  assert.ok(lines.some((line) => line.includes("/api-audit discover")));
  assert.ok(lines.some((line) => line.includes("Layer A")));
});
