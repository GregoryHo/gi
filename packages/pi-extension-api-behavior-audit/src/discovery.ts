import { readFile } from "node:fs/promises";
import type { Browser, BrowserContext, Page } from "playwright";

import { isLocalHttpUrl } from "./config.ts";
import { getEnvironmentProfileConfigPath } from "./environment-profiles.ts";
import { isAllowedProxyTarget } from "./proxy-config.ts";
import { startRecordingProxy } from "./recording-proxy.ts";
import { redactUrl } from "./redaction.ts";
import type {
  NormalizedProfile,
  PreparedScenarioDiscoverySession,
  ProfileConfigV1,
  ProfileConfigV2,
  ProfileTargetV2,
  ProfileV1,
  ProfileV2,
  ScenarioDiscoveryBrowserHandle,
  ScenarioDiscoveryCaptureWindowDeps,
  ScenarioDiscoveryCaptureWindowInput,
  ScenarioDiscoveryDeps,
  ScenarioDiscoveryPlan,
  ScenarioDiscoveryPlanInput,
  ScenarioDiscoveryPrompts,
  ScenarioDiscoveryRecordedArtifact,
  ScenarioDiscoveryRecorderHandle,
  ScenarioDiscoveryResult,
  ScenarioDiscoveryTarget,
} from "./discovery-types.ts";
import type { ApiSide, BrowserVisibleApiObservation, CandidatePageContext } from "./types.ts";

export type {
  PreparedScenarioDiscoverySession,
  ScenarioDiscoveryBrowserHandle,
  ScenarioDiscoveryCaptureWindowDeps,
  ScenarioDiscoveryCaptureWindowInput,
  ScenarioDiscoveryDeps,
  ScenarioDiscoveryPlan,
  ScenarioDiscoveryPlanInput,
  ScenarioDiscoveryPrompts,
  ScenarioDiscoveryRecordedArtifact,
  ScenarioDiscoveryRecorderHandle,
  ScenarioDiscoveryResult,
  ScenarioDiscoveryTarget,
} from "./discovery-types.ts";

export class ScenarioDiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioDiscoveryError";
  }
}

const DEFAULT_ARTIFACT_DIR = ".pi-api-audit-runs";
const DEFAULT_OLD_PROXY_PORT = 18080;
const DEFAULT_NEW_PROXY_PORT = 18081;

export async function resolveScenarioDiscoveryPlan(input: ScenarioDiscoveryPlanInput): Promise<ScenarioDiscoveryPlan> {
  if (!input.candidateScenarioId) throw new ScenarioDiscoveryError("candidateScenarioId is required");
  const artifactDir = input.artifactDir ?? DEFAULT_ARTIFACT_DIR;
  const config = await loadProfileConfig(artifactDir);
  const profile = normalizeProfile(config, input.profileName);
  const targetIds = selectTargetIds(profile, input);
  const candidatePagePath = input.candidatePagePath ? normalizePath(input.candidatePagePath) : undefined;

  const targets = targetIds.map((targetId) => {
    const target = profile.targets[targetId];
    if (!target) throw new ScenarioDiscoveryError(`Target not found in profile ${profile.profileName}: ${targetId}`);
    validateTarget(targetId, target);
    return {
      targetId,
      variant: target.variant,
      side: target.side ?? inferSide(targetId, target.variant),
      frontendUrl: normalizeUrl(target.frontendUrl),
      upstreamTargetUrl: normalizeUrl(target.upstreamTargetUrl),
      recorderPort: target.recorderPort,
      recorderUrl: `http://127.0.0.1:${target.recorderPort}`,
      allowHosts: [...(target.allowHosts ?? [])],
      ...(candidatePagePath ? { candidatePagePath } : {}),
    };
  });

  const ports = new Set<number>();
  for (const target of targets) {
    if (ports.has(target.recorderPort)) throw new ScenarioDiscoveryError(`Duplicate recorder port: ${target.recorderPort}`);
    ports.add(target.recorderPort);
  }

  return {
    artifactDir,
    profileName: profile.profileName,
    candidateScenarioId: input.candidateScenarioId,
    ...(candidatePagePath ? { candidatePagePath } : {}),
    targets,
  };
}

export function buildScenarioDiscoveryPreparation(plan: ScenarioDiscoveryPlan): string[] {
  return [
    "Manual-assisted scenario discovery",
    `Candidate scenario id: ${plan.candidateScenarioId}`,
    `Profile: ${plan.profileName}`,
    `Selected targets: ${plan.targets.map((target) => target.targetId).join(", ")}`,
    ...plan.targets.flatMap((target) => [
      `Target ${target.targetId} (${target.variant})`,
      `  frontend: ${target.frontendUrl}${target.candidatePagePath ?? ""}`,
      `  recorder: ${target.recorderUrl}`,
      `  upstream target: ${target.upstreamTargetUrl}`,
      `  configure this app/API proxy to point to ${target.recorderUrl}`,
    ]),
    "This discovery does not modify scenario dictionary SOT.",
    "Operate only test accounts/non-production-safe flows, especially for state-changing scenarios.",
    "When you are done operating the browser, return to pi and confirm done.",
  ];
}

export async function prepareScenarioDiscoverySession(
  plan: ScenarioDiscoveryPlan,
  deps: Pick<ScenarioDiscoveryDeps, "startRecorder"> = {},
): Promise<PreparedScenarioDiscoverySession> {
  const startRecorder = deps.startRecorder ?? startPausedScenarioDiscoveryRecorder;
  const recorders = [] as Array<{ target: ScenarioDiscoveryTarget; recorder: ScenarioDiscoveryRecorderHandle }>;
  for (const target of plan.targets) {
    recorders.push({ target, recorder: await startRecorder(target, plan) });
  }
  return { sessionId: `discovery-${Date.now()}`, plan, recorders };
}

export function formatPreparedScenarioDiscoverySessions(sessions: PreparedScenarioDiscoverySession[]): string[] {
  if (sessions.length === 0) return ["Active scenario discovery sessions: none"];
  return [
    "Active scenario discovery sessions:",
    ...sessions.flatMap((session) => [
      `${session.sessionId} candidate=${session.plan.candidateScenarioId} profile=${session.plan.profileName}`,
      ...session.recorders.map(
        ({ target, recorder }) =>
          `  target ${target.targetId} (${target.variant}) ${recorder.recording ? "recording" : "paused"} recorder=${recorder.listenUrl} exchanges=${recorder.exchangeCount}`,
      ),
    ]),
  ];
}

export async function stopPreparedScenarioDiscoverySession(session: PreparedScenarioDiscoverySession): Promise<void> {
  await Promise.all(session.recorders.map(({ recorder }) => recorder.stop()));
}

export async function capturePreparedScenarioDiscoveryWindow(
  session: PreparedScenarioDiscoverySession,
  input: ScenarioDiscoveryCaptureWindowInput,
  prompts: ScenarioDiscoveryPrompts,
  deps: ScenarioDiscoveryCaptureWindowDeps = {},
): Promise<ScenarioDiscoveryResult> {
  const captureBrowserPageContext = deps.captureBrowserPageContext ?? captureDiscoveryBrowserPageContext;
  if (input.browser) {
    const windowRecorders: Array<{ target: ScenarioDiscoveryTarget; recorder: ScenarioDiscoveryRecordedArtifact }> = [];
    for (const { target, recorder } of session.recorders) {
      const windowTarget = { ...target, ...(input.candidatePagePath ? { candidatePagePath: input.candidatePagePath } : {}) };
      const windowRecorder = recorder.beginRecordingWindow
        ? await recorder.beginRecordingWindow({
            scenarioId: input.candidateScenarioId,
            candidateScenarioId: input.candidateScenarioId,
            discoverySessionId: session.sessionId,
            ...(input.comparisonRunId ? { comparisonRunId: input.comparisonRunId } : {}),
            purpose: "scenario-discovery",
          })
        : recorder;
      windowRecorders.push({ target: windowTarget, recorder: windowRecorder });
      let candidatePage: CandidatePageContext | undefined;
      try {
        candidatePage = await captureBrowserPageContext(windowTarget, input, prompts);
      } finally {
        await windowRecorder.finish?.(candidatePage ? { candidatePage } : undefined);
      }
    }
    const warnings = buildNoExchangeWarnings(windowRecorders);
    return { recorders: windowRecorders, warnings };
  }

  const windowRecorders: Array<{ target: ScenarioDiscoveryTarget; recorder: ScenarioDiscoveryRecordedArtifact }> = [];
  try {
    for (const { target, recorder } of session.recorders) {
      const windowRecorder = recorder.beginRecordingWindow
        ? await recorder.beginRecordingWindow({
            scenarioId: input.candidateScenarioId,
            candidateScenarioId: input.candidateScenarioId,
            discoverySessionId: session.sessionId,
            ...(input.comparisonRunId ? { comparisonRunId: input.comparisonRunId } : {}),
            purpose: "scenario-discovery",
          })
        : recorder;
      windowRecorders.push({ target: { ...target, ...(input.candidatePagePath ? { candidatePagePath: input.candidatePagePath } : {}) }, recorder: windowRecorder });
    }
    const done = await prompts.confirm(
      `Recording window is active for candidate scenario ${input.candidateScenarioId}. Manually operate the browser now, then confirm done.`,
    );
    if (!done) throw new ScenarioDiscoveryError("Cancelled active scenario discovery capture window.");
  } finally {
    await Promise.all(windowRecorders.map(async ({ recorder }) => recorder.finish?.()));
  }
  const warnings = buildNoExchangeWarnings(windowRecorders);
  return { recorders: windowRecorders, warnings };
}

export async function runPreparedScenarioDiscoverySession(
  session: PreparedScenarioDiscoverySession,
  prompts: ScenarioDiscoveryPrompts,
): Promise<ScenarioDiscoveryResult> {
  try {
    for (const { recorder } of session.recorders) {
      await recorder.setRecording?.(true);
    }
    const done = await prompts.confirm(
      `Recording is active for candidate scenario ${session.plan.candidateScenarioId}. Manually operate the browser now, then confirm done.`,
    );
    if (!done) throw new ScenarioDiscoveryError("Cancelled active scenario discovery recording.");
  } finally {
    await Promise.all(session.recorders.map(({ recorder }) => recorder.stop()));
  }
  const warnings = buildNoExchangeWarnings(session.recorders);
  return { recorders: session.recorders, warnings };
}

export async function runScenarioDiscovery(
  plan: ScenarioDiscoveryPlan,
  deps: ScenarioDiscoveryDeps & Partial<ScenarioDiscoveryPrompts> = {},
): Promise<ScenarioDiscoveryResult> {
  const prompts: ScenarioDiscoveryPrompts = {
    confirm: deps.confirm ?? (async () => true),
    notify: deps.notify,
  };
  const startRecorder = deps.startRecorder ?? startScenarioDiscoveryRecorder;
  const runManualPageAction = deps.runManualPageAction ?? runManualDiscoveryPageAction;

  const ready = await prompts.confirm(buildScenarioDiscoveryPreparation(plan).join("\n"));
  if (!ready) throw new ScenarioDiscoveryError("Cancelled scenario discovery before manual recording.");

  const recorders: Array<{ target: ScenarioDiscoveryTarget; recorder: ScenarioDiscoveryRecorderHandle }> = [];
  try {
    for (const target of plan.targets) {
      recorders.push({ target, recorder: await startRecorder(target, plan) });
    }
    for (const target of plan.targets) {
      prompts.notify?.(`Manual discovery target ready: ${target.targetId}`);
      await runManualPageAction(target, plan, prompts);
    }
  } finally {
    await Promise.all(recorders.map(({ recorder }) => recorder.stop()));
  }

  const warnings = buildNoExchangeWarnings(recorders);
  return { recorders, warnings };
}

export async function startPausedScenarioDiscoveryRecorder(
  target: ScenarioDiscoveryTarget,
  plan: ScenarioDiscoveryPlan,
): Promise<ScenarioDiscoveryRecorderHandle> {
  return startScenarioDiscoveryRecorder(target, plan, false);
}

export async function startScenarioDiscoveryRecorder(
  target: ScenarioDiscoveryTarget,
  plan: ScenarioDiscoveryPlan,
  record = true,
): Promise<ScenarioDiscoveryRecorderHandle> {
  return startRecordingProxy({
    side: target.side,
    listenHost: "127.0.0.1",
    listenPort: target.recorderPort,
    targetBaseUrl: target.upstreamTargetUrl,
    artifactDir: plan.artifactDir,
    scenarioId: plan.candidateScenarioId,
    targetId: target.targetId,
    variant: target.variant,
    purpose: "scenario-discovery",
    candidateScenarioId: plan.candidateScenarioId,
    record,
  });
}

export async function openScenarioDiscoveryBrowserTarget(
  target: ScenarioDiscoveryTarget,
  candidatePagePath?: string,
): Promise<ScenarioDiscoveryBrowserHandle> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${target.frontendUrl}${candidatePagePath ? normalizePath(candidatePagePath) : target.candidatePagePath ?? ""}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  return createScenarioDiscoveryBrowserHandle(browser, context, page, target);
}

export function createScenarioDiscoveryBrowserHandle(
  browser: Browser,
  context: BrowserContext,
  page: Page,
  target: ScenarioDiscoveryTarget,
): ScenarioDiscoveryBrowserHandle {
  return {
    target,
    page,
    getCandidatePageContext: () => {
      const url = page.url();
      return { url, path: extractPathFromUrl(url), source: "playwright-page-url" };
    },
    startBrowserVisibleApiCapture: () => startBrowserVisibleApiCapture(page),
    close: async () => {
      await context.close();
      await browser.close();
    },
  };
}

export function startBrowserVisibleApiCapture(page: Page): { observations: BrowserVisibleApiObservation[]; stop(): void } {
  const observations: BrowserVisibleApiObservation[] = [];
  const onResponse = (response: { request(): { method(): string; resourceType(): string }; url(): string; status(): number }) => {
    const request = response.request();
    if (!["fetch", "xhr"].includes(request.resourceType())) return;
    const url = redactUrl(response.url());
    observations.push({
      method: request.method(),
      url,
      path: extractPathFromUrl(url),
      status: response.status(),
      source: "playwright-response",
    });
  };
  page.on("response", onResponse as never);
  return {
    observations,
    stop: () => page.off("response", onResponse as never),
  };
}

export async function captureDiscoveryBrowserPageContext(
  target: ScenarioDiscoveryTarget,
  input: ScenarioDiscoveryCaptureWindowInput,
  prompts: ScenarioDiscoveryPrompts,
): Promise<CandidatePageContext> {
  const handle = await openScenarioDiscoveryBrowserTarget(target, input.candidatePagePath);
  try {
    const done = await prompts.confirm(
      `Manually operate target ${target.targetId} (${target.variant}) now. Return here and confirm when done.`,
    );
    if (!done) throw new ScenarioDiscoveryError(`Cancelled scenario discovery for target ${target.targetId}.`);
    await handle.page.waitForTimeout(500);
    return handle.getCandidatePageContext();
  } finally {
    await handle.close();
  }
}

export async function runManualDiscoveryPageAction(
  target: ScenarioDiscoveryTarget,
  _plan: ScenarioDiscoveryPlan,
  prompts: ScenarioDiscoveryPrompts,
): Promise<void> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: false });
  try {
    await openDiscoveryTarget(browser, target, prompts);
  } finally {
    await browser.close();
  }
}

async function openDiscoveryTarget(
  browser: Browser,
  target: ScenarioDiscoveryTarget,
  prompts: ScenarioDiscoveryPrompts,
): Promise<string> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(`${target.frontendUrl}${target.candidatePagePath ?? ""}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const done = await prompts.confirm(
      `Manually operate target ${target.targetId} (${target.variant}) now. Return here and confirm when done.`,
    );
    if (!done) throw new ScenarioDiscoveryError(`Cancelled scenario discovery for target ${target.targetId}.`);
    await page.waitForTimeout(500);
    return page.url();
  } finally {
    await context.close();
  }
}

async function loadProfileConfig(artifactDir: string): Promise<ProfileConfigV1 | ProfileConfigV2> {
  let raw: string;
  try {
    raw = await readFile(getEnvironmentProfileConfigPath(artifactDir), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ScenarioDiscoveryError(`No environment profile config found at ${getEnvironmentProfileConfigPath(artifactDir)}`);
    }
    throw error;
  }
  const parsed = JSON.parse(raw) as ProfileConfigV1 | ProfileConfigV2;
  if (parsed.version !== 1 && parsed.version !== 2) throw new ScenarioDiscoveryError("Environment profile config version must be 1 or 2");
  return parsed;
}

function normalizeProfile(config: ProfileConfigV1 | ProfileConfigV2, requestedProfileName?: string): NormalizedProfile {
  const profileName = requestedProfileName ?? config.defaultProfile ?? Object.keys(config.profiles)[0];
  if (!profileName) throw new ScenarioDiscoveryError("No environment profiles are configured");
  const profile = config.profiles[profileName];
  if (!profile) throw new ScenarioDiscoveryError(`Environment profile not found: ${profileName}`);

  if (config.version === 2) {
    const v2 = profile as ProfileV2;
    return { profileName, targets: v2.targets, groups: v2.groups ?? {} };
  }

  const v1 = profile as ProfileV1;
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

function selectTargetIds(profile: NormalizedProfile, input: ScenarioDiscoveryPlanInput): string[] {
  if (input.targetIds?.length) return input.targetIds;
  if (input.groupName) {
    const group = profile.groups[input.groupName];
    if (!group) throw new ScenarioDiscoveryError(`Target group not found in profile ${profile.profileName}: ${input.groupName}`);
    return group;
  }
  if (profile.groups.default?.length) return profile.groups.default;
  return Object.keys(profile.targets);
}

function validateTarget(targetId: string, target: ProfileTargetV2): void {
  const frontendUrl = normalizeUrl(target.frontendUrl);
  const upstreamTargetUrl = normalizeUrl(target.upstreamTargetUrl);
  if (!isLocalHttpUrl(frontendUrl)) throw new ScenarioDiscoveryError(`Target ${targetId} frontendUrl must be local http URL`);
  if (!Number.isInteger(target.recorderPort) || target.recorderPort < 1 || target.recorderPort > 65535) {
    throw new ScenarioDiscoveryError(`Target ${targetId} recorderPort must be an integer from 1 to 65535`);
  }
  if (!isAllowedProxyTarget(upstreamTargetUrl, target.allowHosts ?? [])) {
    throw new ScenarioDiscoveryError(`Target ${targetId} upstreamTargetUrl must be local or explicitly allowlisted`);
  }
}

function buildNoExchangeWarnings(
  recorders: Array<{ target: ScenarioDiscoveryTarget; recorder: ScenarioDiscoveryRecordedArtifact }>,
): string[] {
  return recorders
    .filter(({ recorder }) => recorder.exchangeCount === 0)
    .map(
      ({ target }) =>
        `No upstream exchanges were recorded for discovery target ${target.targetId}; confirm the app points to ${target.recorderUrl}.`,
    );
}

function inferSide(targetId: string, variant: string): ApiSide {
  const marker = `${targetId}:${variant}`.toLowerCase();
  return marker.includes("old") || marker.includes("baseline") ? "old" : "new";
}

function normalizePath(value: string): string {
  return value.startsWith("/") ? value : `/${value}`;
}

function normalizeUrl(value: string): string {
  return new URL(value).toString().replace(/\/+$/, "");
}

function extractPathFromUrl(value: string): string {
  const url = new URL(value);
  return `${url.pathname}${url.search}${url.hash}` || "/";
}
