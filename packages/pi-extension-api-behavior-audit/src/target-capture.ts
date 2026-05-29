import { readFile } from "node:fs/promises";
import type { Browser } from "playwright";

import { getEnvironmentProfileConfigPath } from "./environment-profiles.ts";
import { isLocalHttpUrl } from "./config.ts";
import { isAllowedProxyTarget } from "./proxy-config.ts";
import { startRecordingProxy } from "./recording-proxy.ts";
import { getDictionaryScenario, loadScenarioDictionary } from "./scenario-dictionary.ts";
import type { ApiSide } from "./types.ts";

export class TargetCaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TargetCaptureError";
  }
}

export interface TargetCapturePlanInput {
  artifactDir?: string;
  profileName?: string;
  scenarioId: string;
  scenarioDictionaryPath?: string;
  targetIds?: string[];
  groupName?: string;
}

export interface ResolvedTargetCaptureTarget {
  targetId: string;
  variant: string;
  side: ApiSide;
  frontendUrl: string;
  upstreamTargetUrl: string;
  recorderPort: number;
  recorderUrl: string;
  allowHosts: string[];
  pagePath: string;
  browserApiAllowlist: string[];
  upstreamApiCandidates: string[];
}

export interface TargetCapturePlan {
  profileName: string;
  scenarioId: string;
  feature: string;
  description: string;
  artifactDir: string;
  targets: ResolvedTargetCaptureTarget[];
}

export interface TargetRecorderHandle {
  runId: string;
  listenUrl: string;
  manifestPath: string;
  exchangesPath: string;
  exchangeCount: number;
  stop(): Promise<void>;
}

export interface TargetCapturePrompts {
  confirm(message: string): Promise<boolean>;
  notify?(message: string): void;
}

export interface TargetCaptureDeps {
  startRecorder?: (target: ResolvedTargetCaptureTarget, plan: TargetCapturePlan) => Promise<TargetRecorderHandle>;
  runTargetPageAction?: (target: ResolvedTargetCaptureTarget, plan: TargetCapturePlan, prompts: TargetCapturePrompts) => Promise<void>;
}

export interface TargetCaptureResult {
  recorders: Array<{ target: ResolvedTargetCaptureTarget; recorder: TargetRecorderHandle }>;
  warnings: string[];
}

interface TargetEnvironmentConfigV1 {
  version: 1;
  profiles: Record<string, EnvironmentProfileV1>;
  defaultProfile?: string;
}

interface EnvironmentProfileV1 {
  oldUrl: string;
  newUrl: string;
  oldTargetUrl: string;
  newTargetUrl: string;
  oldProxyPort?: number;
  newProxyPort?: number;
  allowHosts?: string[];
}

interface TargetEnvironmentConfigV2 {
  version: 2;
  profiles: Record<string, TargetEnvironmentProfileV2>;
  defaultProfile?: string;
}

interface TargetEnvironmentProfileV2 {
  targets: Record<string, TargetEnvironmentProfileTargetV2>;
  groups?: Record<string, string[]>;
}

interface TargetEnvironmentProfileTargetV2 {
  variant: string;
  side?: ApiSide;
  frontendUrl: string;
  upstreamTargetUrl: string;
  recorderPort: number;
  allowHosts?: string[];
}

interface NormalizedTargetProfile {
  profileName: string;
  targets: Record<string, TargetEnvironmentProfileTargetV2>;
  groups: Record<string, string[]>;
}

interface ScenarioDictionaryV2 {
  version: 2;
  scenarios: ScenarioVariantEntry[];
}

interface ScenarioVariantEntry {
  id: string;
  feature: string;
  description: string;
  type: "read-only";
  variants: Record<string, ScenarioVariant>;
}

interface ScenarioVariant {
  pagePath: string;
  browserApiAllowlist: string[];
  upstreamApiCandidates: string[];
}

const DEFAULT_ARTIFACT_DIR = ".pi-api-audit-runs";
const DEFAULT_OLD_PROXY_PORT = 18080;
const DEFAULT_NEW_PROXY_PORT = 18081;

export async function resolveTargetCapturePlan(input: TargetCapturePlanInput): Promise<TargetCapturePlan> {
  const artifactDir = input.artifactDir ?? DEFAULT_ARTIFACT_DIR;
  const profileConfig = await loadTargetEnvironmentConfig(artifactDir);
  const profile = normalizeProfile(profileConfig, input.profileName);
  const scenario = await loadScenarioVariants(input.scenarioDictionaryPath, input.scenarioId);
  const selectedTargetIds = selectTargetIds(profile, input);

  const targets = selectedTargetIds.map((targetId) => {
    const target = profile.targets[targetId];
    if (!target) throw new TargetCaptureError(`Target not found in profile ${profile.profileName}: ${targetId}`);
    const variant = scenario.variants[target.variant];
    if (!variant) throw new TargetCaptureError(`Scenario ${scenario.id} does not define variant ${target.variant} for target ${targetId}`);
    validateTarget(targetId, target);
    return {
      targetId,
      variant: target.variant,
      side: target.side ?? inferCompatSide(targetId, target.variant),
      frontendUrl: normalizeUrl(target.frontendUrl),
      upstreamTargetUrl: normalizeUrl(target.upstreamTargetUrl),
      recorderPort: target.recorderPort,
      recorderUrl: `http://127.0.0.1:${target.recorderPort}`,
      allowHosts: [...(target.allowHosts ?? [])],
      pagePath: variant.pagePath,
      browserApiAllowlist: [...variant.browserApiAllowlist],
      upstreamApiCandidates: [...variant.upstreamApiCandidates],
    };
  });

  const recorderPorts = new Set<number>();
  for (const target of targets) {
    if (recorderPorts.has(target.recorderPort)) throw new TargetCaptureError(`Duplicate recorder port: ${target.recorderPort}`);
    recorderPorts.add(target.recorderPort);
  }

  return {
    profileName: profile.profileName,
    scenarioId: scenario.id,
    feature: scenario.feature,
    description: scenario.description,
    artifactDir,
    targets,
  };
}

export async function runTargetCapture(
  plan: TargetCapturePlan,
  deps: TargetCaptureDeps & Partial<TargetCapturePrompts>,
): Promise<TargetCaptureResult> {
  const prompts: TargetCapturePrompts = {
    confirm: deps.confirm ?? (async () => true),
    notify: deps.notify,
  };
  const startRecorder = deps.startRecorder ?? startTargetRecordingProxy;
  const runTargetPageAction = deps.runTargetPageAction ?? runTargetBrowserPageAction;
  const ready = await prompts.confirm(buildTargetCapturePreparation(plan).join("\n"));
  if (!ready) throw new TargetCaptureError("Cancelled target capture before page actions.");

  const recorders: Array<{ target: ResolvedTargetCaptureTarget; recorder: TargetRecorderHandle }> = [];
  try {
    for (const target of plan.targets) {
      recorders.push({ target, recorder: await startRecorder(target, plan) });
    }
    for (const target of plan.targets) {
      prompts.notify?.(`Running target page action: ${target.targetId}`);
      await runTargetPageAction(target, plan, prompts);
    }
  } finally {
    await Promise.all(recorders.map(({ recorder }) => recorder.stop()));
  }

  const warnings = recorders
    .filter(({ recorder }) => recorder.exchangeCount === 0)
    .map(
      ({ target }) =>
        `No upstream exchanges were recorded for target ${target.targetId}; confirm the app points to ${target.recorderUrl}.`,
    );
  return { recorders, warnings };
}

export async function startTargetRecordingProxy(
  target: ResolvedTargetCaptureTarget,
  plan: TargetCapturePlan,
): Promise<TargetRecorderHandle> {
  return startRecordingProxy({
    side: target.side,
    listenHost: "127.0.0.1",
    listenPort: target.recorderPort,
    targetBaseUrl: target.upstreamTargetUrl,
    artifactDir: plan.artifactDir,
    scenarioId: plan.scenarioId,
    targetId: target.targetId,
    variant: target.variant,
  });
}

export async function runTargetBrowserPageAction(
  target: ResolvedTargetCaptureTarget,
  _plan: TargetCapturePlan,
  prompts: TargetCapturePrompts,
): Promise<void> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: false });
  try {
    await navigateTarget(browser, target, prompts);
  } finally {
    await browser.close();
  }
}

export function buildTargetCapturePreparation(plan: TargetCapturePlan): string[] {
  return [
    `Target capture preparation: ${plan.scenarioId} — ${plan.feature}`,
    `Profile: ${plan.profileName}`,
    `Artifact dir: ${plan.artifactDir}`,
    `Selected targets: ${plan.targets.map((target) => target.targetId).join(", ")}`,
    ...plan.targets.flatMap((target) => [
      `Target ${target.targetId} (${target.variant})`,
      `  frontend: ${target.frontendUrl}${target.pagePath}`,
      `  recorder: ${target.recorderUrl}`,
      `  upstream target: ${target.upstreamTargetUrl}`,
      `  expected upstream candidates: ${target.upstreamApiCandidates.join(", ")}`,
      `  configure this app/API proxy to point to ${target.recorderUrl}`,
    ]),
    "Restart local apps if their proxy config is read at startup.",
    "Do not use production targets for this smoke.",
  ];
}

async function loadTargetEnvironmentConfig(artifactDir: string): Promise<TargetEnvironmentConfigV1 | TargetEnvironmentConfigV2> {
  let raw: string;
  try {
    raw = await readFile(getEnvironmentProfileConfigPath(artifactDir), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new TargetCaptureError(`No environment profile config found at ${getEnvironmentProfileConfigPath(artifactDir)}`);
    }
    throw error;
  }
  const value = JSON.parse(raw) as TargetEnvironmentConfigV1 | TargetEnvironmentConfigV2;
  if (value.version !== 1 && value.version !== 2) throw new TargetCaptureError("Environment profile config version must be 1 or 2");
  return value;
}

function normalizeProfile(config: TargetEnvironmentConfigV1 | TargetEnvironmentConfigV2, requestedProfileName?: string): NormalizedTargetProfile {
  const profileName = requestedProfileName ?? config.defaultProfile ?? Object.keys(config.profiles)[0];
  if (!profileName) throw new TargetCaptureError("No environment profiles are configured");
  const profile = config.profiles[profileName];
  if (!profile) throw new TargetCaptureError(`Environment profile not found: ${profileName}`);

  if (config.version === 2) {
    const v2 = profile as TargetEnvironmentProfileV2;
    return { profileName, targets: v2.targets, groups: v2.groups ?? {} };
  }

  const v1 = profile as EnvironmentProfileV1;
  return {
    profileName,
    targets: {
      old: {
        variant: "old",
        side: "old",
        frontendUrl: v1.oldUrl,
        upstreamTargetUrl: v1.oldTargetUrl,
        recorderPort: v1.oldProxyPort ?? DEFAULT_OLD_PROXY_PORT,
        allowHosts: v1.allowHosts,
      },
      new: {
        variant: "new",
        side: "new",
        frontendUrl: v1.newUrl,
        upstreamTargetUrl: v1.newTargetUrl,
        recorderPort: v1.newProxyPort ?? DEFAULT_NEW_PROXY_PORT,
        allowHosts: v1.allowHosts,
      },
    },
    groups: { default: ["old", "new"], all: ["old", "new"] },
  };
}

function selectTargetIds(profile: NormalizedTargetProfile, input: TargetCapturePlanInput): string[] {
  if (input.targetIds?.length) return input.targetIds;
  if (input.groupName) {
    const group = profile.groups[input.groupName];
    if (!group) throw new TargetCaptureError(`Target group not found in profile ${profile.profileName}: ${input.groupName}`);
    return group;
  }
  if (profile.groups.default?.length) return profile.groups.default;
  return Object.keys(profile.targets);
}

async function loadScenarioVariants(path: string | undefined, scenarioId: string): Promise<ScenarioVariantEntry> {
  if (!path) throw new TargetCaptureError("A workspace scenario dictionary path is required; package scenarios are examples only.");

  const raw = await readFile(path, "utf8");
  const value = JSON.parse(raw) as ScenarioDictionaryV2 | { version: 1 };
  if (value.version === 2) {
    const scenario = (value as ScenarioDictionaryV2).scenarios.find((item) => item.id === scenarioId);
    if (!scenario) throw new TargetCaptureError(`Scenario not found: ${scenarioId}`);
    return scenario;
  }

  const dictionary = await loadScenarioDictionary(path);
  const scenario = getDictionaryScenario(dictionary, scenarioId);
  return {
    id: scenario.id,
    feature: scenario.feature,
    description: scenario.description,
    type: scenario.type,
    variants: {
      old: {
        pagePath: scenario.page.oldPath,
        browserApiAllowlist: scenario.browserApiAllowlist.old,
        upstreamApiCandidates: scenario.upstreamApiCandidates.old,
      },
      new: {
        pagePath: scenario.page.newPath,
        browserApiAllowlist: scenario.browserApiAllowlist.new,
        upstreamApiCandidates: scenario.upstreamApiCandidates.new,
      },
    },
  };
}

async function navigateTarget(
  browser: Browser,
  target: ResolvedTargetCaptureTarget,
  prompts: TargetCapturePrompts,
): Promise<void> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(target.frontendUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const ready = await prompts.confirm(
      `Log in to target ${target.targetId} (${target.variant}) if needed, then confirm to navigate ${target.pagePath}.`,
    );
    if (!ready) throw new TargetCaptureError(`Cancelled target page action: ${target.targetId}`);
    await page.goto(`${target.frontendUrl}${target.pagePath}`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(1_500);
  } finally {
    await context.close();
  }
}

function validateTarget(targetId: string, target: TargetEnvironmentProfileTargetV2): void {
  const frontendUrl = normalizeUrl(target.frontendUrl);
  const upstreamTargetUrl = normalizeUrl(target.upstreamTargetUrl);
  if (!isLocalHttpUrl(frontendUrl)) throw new TargetCaptureError(`Target ${targetId} frontendUrl must be local http URL`);
  if (!Number.isInteger(target.recorderPort) || target.recorderPort < 1 || target.recorderPort > 65535) {
    throw new TargetCaptureError(`Target ${targetId} recorderPort must be an integer from 1 to 65535`);
  }
  if (!isAllowedProxyTarget(upstreamTargetUrl, target.allowHosts ?? [])) {
    throw new TargetCaptureError(`Target ${targetId} upstreamTargetUrl must be local or explicitly allowlisted`);
  }
}

function inferCompatSide(targetId: string, variant: string): ApiSide {
  const marker = `${targetId}:${variant}`.toLowerCase();
  return marker.includes("old") || marker.includes("baseline") ? "old" : "new";
}

function normalizeUrl(value: string): string {
  return new URL(value).toString().replace(/\/+$/, "");
}
