import { execFile } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { CaptureSessionRegistry, type CaptureSessionSummary, type StartCaptureSessionDeps } from "./capture-lifecycle.ts";
import type { TargetCapturePlan } from "../adapters/target-capture.ts";

export type AutomationStatus = "succeeded" | "failed" | "timed-out";

export interface AutomatedCaptureOptions {
  automationScript?: string;
  headless?: boolean;
  openBrowser?: boolean;
  stopOnNetworkIdleMs?: number;
  maxDurationMs?: number;
}

export interface AutomationMetadataTarget extends Record<string, unknown> {
  targetId: string;
  variant: string;
  side: string;
  frontendUrl: string;
  pagePath: string;
  proxyUrl: string;
  runId: string;
  runDir: string;
  manifestPath: string;
  exchangesPath: string;
}

export interface AutomationMetadata extends Record<string, unknown> {
  captureSessionId: string;
  scenarioId: string;
  profileName: string;
  artifactDir: string;
  headless: boolean;
  openBrowser: boolean;
  maxDurationMs: number;
  stopOnNetworkIdleMs?: number;
  targets: AutomationMetadataTarget[];
  oldProxyUrl?: string;
  newProxyUrl?: string;
  oldRunDir?: string;
  newRunDir?: string;
}

export interface AutomationExecutionResult extends Record<string, unknown> {
  status: AutomationStatus;
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
  error?: string;
  metadataPath?: string;
}

export interface AutomationScriptInput {
  scriptPath: string;
  metadataPath: string;
  metadata: AutomationMetadata;
  headless: boolean;
  signal: AbortSignal;
}

export interface AutomatedCaptureDeps extends StartCaptureSessionDeps {
  registry?: CaptureSessionRegistry;
  runScript?: (input: AutomationScriptInput) => Promise<AutomationExecutionResult>;
}

export interface AutomatedCaptureResult extends Record<string, unknown> {
  capture: CaptureSessionSummary;
  automation: AutomationExecutionResult;
}

const DEFAULT_MAX_DURATION_MS = 120_000;

export async function runAutomatedCapture(
  plan: TargetCapturePlan,
  options: AutomatedCaptureOptions,
  deps: AutomatedCaptureDeps = {},
): Promise<AutomatedCaptureResult> {
  if (!options.automationScript) {
    throw new Error("automationScript is required for automated capture when built-in browser automation is not configured.");
  }
  if (options.openBrowser === true) {
    throw new Error("Built-in browser automation is not implemented yet; provide automationScript with openBrowser false.");
  }

  const registry = deps.registry ?? new CaptureSessionRegistry();
  const maxDurationMs = options.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
  const started = await registry.start(plan, { startRecorder: deps.startRecorder });
  const metadata = buildAutomationMetadata(started, plan, { ...options, maxDurationMs });
  const metadataPath = await writeAutomationMetadata(plan.artifactDir, started.captureSessionId, metadata);
  const runScript = deps.runScript ?? defaultAutomationScriptRunner;
  let automation: AutomationExecutionResult;

  try {
    automation = await runWithTimeout(
      (signal) => runScript({
        scriptPath: options.automationScript as string,
        metadataPath,
        metadata,
        headless: metadata.headless,
        signal,
      }),
      maxDurationMs,
    );
  } catch (error) {
    automation = {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      metadataPath,
    };
  } finally {
    // Stop/finalize even when automation fails or times out.
  }

  const capture = await registry.stop(started.captureSessionId);
  return {
    capture,
    automation: { ...automation, metadataPath: automation.metadataPath ?? metadataPath },
  };
}

function buildAutomationMetadata(
  summary: CaptureSessionSummary,
  plan: TargetCapturePlan,
  options: AutomatedCaptureOptions & { maxDurationMs: number },
): AutomationMetadata {
  return {
    captureSessionId: summary.captureSessionId,
    scenarioId: summary.scenarioId,
    profileName: summary.profileName,
    artifactDir: summary.artifactDir,
    headless: options.headless ?? true,
    openBrowser: options.openBrowser ?? false,
    maxDurationMs: options.maxDurationMs,
    ...(options.stopOnNetworkIdleMs !== undefined ? { stopOnNetworkIdleMs: options.stopOnNetworkIdleMs } : {}),
    ...(summary.oldProxyUrl ? { oldProxyUrl: summary.oldProxyUrl } : {}),
    ...(summary.newProxyUrl ? { newProxyUrl: summary.newProxyUrl } : {}),
    ...(summary.oldRunDir ? { oldRunDir: summary.oldRunDir } : {}),
    ...(summary.newRunDir ? { newRunDir: summary.newRunDir } : {}),
    targets: summary.targets.map((target) => {
      const planTarget = plan.targets.find((item) => item.targetId === target.targetId);
      return {
        targetId: target.targetId,
        variant: target.variant,
        side: target.side,
        frontendUrl: planTarget?.frontendUrl ?? "",
        pagePath: planTarget?.pagePath ?? "",
        proxyUrl: target.proxyUrl,
        runId: target.runId,
        runDir: target.runDir,
        manifestPath: target.manifestPath,
        exchangesPath: target.exchangesPath,
      };
    }),
  };
}

async function writeAutomationMetadata(
  artifactDir: string,
  captureSessionId: string,
  metadata: AutomationMetadata,
): Promise<string> {
  const automationDir = join(artifactDir, "automation");
  await mkdir(automationDir, { recursive: true });
  const metadataPath = join(automationDir, `${captureSessionId}.metadata.json`);
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  return metadataPath;
}

async function runWithTimeout(
  run: (signal: AbortSignal) => Promise<AutomationExecutionResult>,
  maxDurationMs: number,
): Promise<AutomationExecutionResult> {
  const controller = new AbortController();
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<AutomationExecutionResult>((resolve) => {
    timeout = setTimeout(() => {
      controller.abort();
      resolve({
        status: "timed-out",
        error: `Automation timed out after ${maxDurationMs}ms.`,
      });
    }, maxDurationMs);
  });

  try {
    return await Promise.race([run(controller.signal), timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function defaultAutomationScriptRunner(input: AutomationScriptInput): Promise<AutomationExecutionResult> {
  const file = await stat(input.scriptPath);
  if (!file.isFile()) throw new Error(`Automation script is not a file: ${input.scriptPath}`);

  return new Promise<AutomationExecutionResult>((resolve) => {
    execFile(
      process.execPath,
      [input.scriptPath, input.metadataPath],
      {
        signal: input.signal,
        env: {
          ...process.env,
          API_AUDIT_AUTOMATION_METADATA_PATH: input.metadataPath,
          API_AUDIT_HEADLESS: String(input.headless),
        },
      },
      (error, stdout, stderr) => {
        if (error) {
          resolve({
            status: "failed",
            exitCode: typeof error === "object" && "code" in error ? Number(error.code) : undefined,
            stdout,
            stderr,
            error: error.message,
          });
          return;
        }
        resolve({ status: "succeeded", exitCode: 0, stdout, stderr });
      },
    );
  });
}
