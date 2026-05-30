import type { Browser } from "playwright";

import { getAccountActivityCaptureUrl, ACCOUNT_ACTIVITY_SCENARIO_ID } from "./browser-capture.ts";
import { isLocalHttpUrl } from "../config/index.ts";
import { isAllowedProxyTarget } from "../config/proxy-config.ts";
import { startRecordingProxy, type RecordingProxyHandle, type StartRecordingProxyOptions } from "./recording-proxy.ts";
import type { CaptureScenario } from "../types.ts";

export class AccountActivityUpstreamConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountActivityUpstreamConfigError";
  }
}

export interface AccountActivityUpstreamConfig {
  command: "account-activity-upstream";
  oldBaseUrl: string;
  newBaseUrl: string;
  oldTargetBaseUrl: string;
  newTargetBaseUrl: string;
  oldProxyPort: number;
  newProxyPort: number;
  artifactDir: string;
  manifestPath?: string;
  allowedHosts: string[];
}

export interface AccountActivityUpstreamCaptureOptions extends Omit<AccountActivityUpstreamConfig, "command" | "manifestPath" | "allowedHosts"> {
  scenario: CaptureScenario;
}

export interface AccountActivityUpstreamPrompts {
  confirm(message: string): Promise<boolean>;
  notify?(message: string): void;
}

export interface AccountActivityPageActionOptions {
  oldBaseUrl: string;
  newBaseUrl: string;
  scenario: CaptureScenario;
}

export interface AccountActivityUpstreamDeps {
  startProxy?: (options: StartRecordingProxyOptions) => Promise<RecordingProxyHandle>;
  runPageActions?: (options: AccountActivityPageActionOptions, prompts: AccountActivityUpstreamPrompts) => Promise<void>;
}

export interface AccountActivityUpstreamResult {
  oldRecorder: RecordingProxyHandle;
  newRecorder: RecordingProxyHandle;
  instructions: string[];
  warnings: string[];
}

const DEFAULT_ARTIFACT_DIR = ".pi-api-audit-runs";

export function parseAccountActivityUpstreamArgs(args: string): AccountActivityUpstreamConfig {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  const command = tokens.shift();
  if (command !== "account-activity-upstream") {
    throw new AccountActivityUpstreamConfigError("Unknown command. Expected: account-activity-upstream");
  }

  const flags = parseFlags(tokens);
  const oldBaseUrl = normalizeUrl(stringFlag(flags, "old-url", "http://localhost:8080"));
  const newBaseUrl = normalizeUrl(stringFlag(flags, "new-url", "http://localhost:8008"));
  if (!isLocalHttpUrl(oldBaseUrl) || !isLocalHttpUrl(newBaseUrl)) {
    throw new AccountActivityUpstreamConfigError("old/new page URLs must be local for M5 integrated capture.");
  }

  const allowedHosts = toArray(flags["allow-host"]);
  const oldTargetBaseUrl = normalizeUrl(stringFlag(flags, "old-target-url"));
  const newTargetBaseUrl = normalizeUrl(stringFlag(flags, "new-target-url"));
  if (!isAllowedProxyTarget(oldTargetBaseUrl, allowedHosts) || !isAllowedProxyTarget(newTargetBaseUrl, allowedHosts)) {
    throw new AccountActivityUpstreamConfigError("old/new backend target URLs must be local or explicitly allowed with --allow-host.");
  }

  const oldProxyPort = parsePort(stringFlag(flags, "old-proxy-port"), "old-proxy-port");
  const newProxyPort = parsePort(stringFlag(flags, "new-proxy-port"), "new-proxy-port");
  if (oldProxyPort === newProxyPort) {
    throw new AccountActivityUpstreamConfigError("old and new proxy ports must be different.");
  }

  const manifestPath = optionalStringFlag(flags, "manifest");

  return {
    command: "account-activity-upstream",
    oldBaseUrl,
    newBaseUrl,
    oldTargetBaseUrl,
    newTargetBaseUrl,
    oldProxyPort,
    newProxyPort,
    artifactDir: stringFlag(flags, "artifact-dir", DEFAULT_ARTIFACT_DIR),
    ...(manifestPath ? { manifestPath } : {}),
    allowedHosts,
  };
}

export function buildAccountActivityUpstreamInstructions(input: {
  oldRecorderUrl: string;
  newRecorderUrl: string;
}): string[] {
  return [
    "Configure local apps before continuing:",
    `- old Go app [api].host should point to ${input.oldRecorderUrl}`,
    `- new app API proxy target should point to ${input.newRecorderUrl}`,
    "Restart local old/new apps if their proxy config is read at startup.",
    "Do not use production targets for this smoke.",
    "After configuration is ready, confirm to open Playwright manual-auth pages.",
  ];
}

export async function runAccountActivityUpstreamCapture(
  options: AccountActivityUpstreamCaptureOptions,
  prompts: AccountActivityUpstreamPrompts,
  deps: AccountActivityUpstreamDeps = {},
): Promise<AccountActivityUpstreamResult> {
  const scenario = options.scenario;
  const startProxy = deps.startProxy ?? startRecordingProxy;
  const runPageActions = deps.runPageActions ?? runAccountActivityPageActions;

  const oldRecorder = await startProxy({
    side: "old",
    listenHost: "127.0.0.1",
    listenPort: options.oldProxyPort,
    targetBaseUrl: options.oldTargetBaseUrl,
    artifactDir: options.artifactDir,
    scenarioId: scenario.id,
  });
  const newRecorder = await startProxy({
    side: "new",
    listenHost: "127.0.0.1",
    listenPort: options.newProxyPort,
    targetBaseUrl: options.newTargetBaseUrl,
    artifactDir: options.artifactDir,
    scenarioId: scenario.id,
  });

  const instructions = buildAccountActivityUpstreamInstructions({
    oldRecorderUrl: oldRecorder.listenUrl,
    newRecorderUrl: newRecorder.listenUrl,
  });

  try {
    const ready = await prompts.confirm(instructions.join("\n"));
    if (!ready) throw new Error("Cancelled account-activity upstream capture before page actions.");

    prompts.notify?.("Running account-activity page actions while upstream recorders are active.");
    await runPageActions({ oldBaseUrl: options.oldBaseUrl, newBaseUrl: options.newBaseUrl, scenario }, prompts);
  } finally {
    await Promise.all([oldRecorder.stop(), newRecorder.stop()]);
  }

  const warnings: string[] = [];
  if (oldRecorder.exchangeCount === 0) {
    warnings.push("No old-side upstream exchanges were recorded; confirm the old app points to the old recorder URL.");
  }
  if (newRecorder.exchangeCount === 0) {
    warnings.push("No new-side upstream exchanges were recorded; confirm the new app points to the new recorder URL.");
  }

  return { oldRecorder, newRecorder, instructions, warnings };
}

export async function runAccountActivityPageActions(
  options: AccountActivityPageActionOptions,
  prompts: AccountActivityUpstreamPrompts,
): Promise<void> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: false });
  try {
    await navigateSide(browser, "old", options.oldBaseUrl, options.scenario, prompts);
    await navigateSide(browser, "new", options.newBaseUrl, options.scenario, prompts);
  } finally {
    await browser.close();
  }
}

async function navigateSide(
  browser: Browser,
  side: "old" | "new",
  baseUrl: string,
  scenario: CaptureScenario,
  prompts: AccountActivityUpstreamPrompts,
): Promise<void> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const pagePath = side === "old" ? scenario.page.oldPath : scenario.page.newPath;
    const ready = await prompts.confirm(`Log in to the ${side} local site if needed, then confirm to navigate ${pagePath}.`);
    if (!ready) throw new Error(`Cancelled ${side} account-activity upstream page action.`);

    await page.goto(getAccountActivityCaptureUrl(baseUrl, side, scenario), { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(1_500);
  } finally {
    await context.close();
  }
}

function parseFlags(tokens: string[]): Record<string, string | string[]> {
  const flags: Record<string, string | string[]> = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) throw new AccountActivityUpstreamConfigError(`Unexpected argument: ${token}`);
    const name = token.slice(2);
    const value = tokens[index + 1];
    if (!value || value.startsWith("--")) throw new AccountActivityUpstreamConfigError(`Missing value for --${name}`);

    if (name === "allow-host") {
      flags[name] = [...toArray(flags[name]), value];
    } else {
      flags[name] = value;
    }
    index += 1;
  }
  return flags;
}

function stringFlag(flags: Record<string, string | string[]>, key: string, fallback?: string): string {
  const value = flags[key];
  if (value === undefined) {
    if (fallback !== undefined) return fallback;
    throw new AccountActivityUpstreamConfigError(`--${key} is required`);
  }
  if (Array.isArray(value)) throw new AccountActivityUpstreamConfigError(`--${key} must be provided once`);
  return value;
}

function optionalStringFlag(flags: Record<string, string | string[]>, key: string): string | undefined {
  const value = flags[key];
  if (value === undefined) return undefined;
  if (Array.isArray(value)) throw new AccountActivityUpstreamConfigError(`--${key} must be provided once`);
  return value;
}

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function parsePort(value: string, flagName: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new AccountActivityUpstreamConfigError(`--${flagName} must be an integer from 1 to 65535`);
  }
  return port;
}

function normalizeUrl(value: string): string {
  return new URL(value).toString().replace(/\/+$/, "");
}
