import type { Browser, Page, Response } from "playwright";

import { appendExchange, createRunId, writeManifest } from "./artifacts.ts";
import { REDACTED, REDACTION_POLICY, sanitizeExchange } from "./redaction.ts";
import type { ApiExchange, ApiSide, CaptureManifest, CaptureScenario } from "./types.ts";

export const ACCOUNT_ACTIVITY_SCENARIO_ID = "account-activity-basic";
const LAYER_A_NOTE = "Layer A browser-visible capture is validation-only, not final backend behavior evidence.";

export interface AccountActivityLayerACaptureOptions {
  oldBaseUrl: string;
  newBaseUrl: string;
  artifactDir: string;
  scenario: CaptureScenario;
}

export interface AccountActivityLayerACapturePrompts {
  confirm(message: string): Promise<boolean>;
  notify?(message: string): void;
}

export interface AccountActivityLayerACaptureResult {
  runId: string;
  runDir: string;
  manifestPath: string;
  exchangesPath: string;
  exchangeCount: number;
}

export function getAccountActivityCaptureUrl(
  baseUrl: string,
  side: ApiSide,
  scenario: CaptureScenario,
): string {
  const path = side === "old" ? scenario.page.oldPath : scenario.page.newPath;
  return new URL(path, `${baseUrl.replace(/\/+$/, "")}/`).toString();
}

export function isAccountActivityApiUrl(
  side: ApiSide,
  rawUrl: string,
  scenario: CaptureScenario,
): boolean {
  try {
    const url = new URL(rawUrl);
    const allowlist = side === "old" ? scenario.apiAllowlist.old : scenario.apiAllowlist.new;
    return allowlist.includes(url.pathname);
  } catch {
    return false;
  }
}

export function createAccountActivityManifest(input: {
  runId: string;
  createdAt: string;
  oldBaseUrl: string;
  newBaseUrl: string;
  startedAt?: string;
  finishedAt?: string;
  exchangeCount?: number;
  scenario: CaptureScenario;
}): CaptureManifest {
  const scenario = input.scenario;
  return {
    runId: input.runId,
    createdAt: input.createdAt,
    artifactVersion: 1,
    redaction: { marker: REDACTED, policy: REDACTION_POLICY },
    scenarios: [scenario.id],
    layer: "browser-visible",
    targets: {
      oldBaseUrl: input.oldBaseUrl,
      newBaseUrl: input.newBaseUrl,
    },
    ...(input.startedAt ? { startedAt: input.startedAt } : {}),
    ...(input.finishedAt ? { finishedAt: input.finishedAt } : {}),
    ...(input.exchangeCount !== undefined ? { exchangeCount: input.exchangeCount } : {}),
    scenarioSnapshots: [scenario],
    notes: [LAYER_A_NOTE],
  };
}

export async function runAccountActivityLayerACapture(
  options: AccountActivityLayerACaptureOptions,
  prompts: AccountActivityLayerACapturePrompts,
): Promise<AccountActivityLayerACaptureResult> {
  const scenario = options.scenario;
  const runId = createRunId();
  const createdAt = new Date().toISOString();
  const startedAt = createdAt;
  await writeManifest(
    options.artifactDir,
    createAccountActivityManifest({
      runId,
      createdAt,
      startedAt,
      oldBaseUrl: options.oldBaseUrl,
      newBaseUrl: options.newBaseUrl,
      scenario,
    }),
  );

  let exchangeCount = 0;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: false });
  try {
    exchangeCount += await captureSide(browser, "old", options.oldBaseUrl, scenario, runId, options.artifactDir, prompts);
    exchangeCount += await captureSide(browser, "new", options.newBaseUrl, scenario, runId, options.artifactDir, prompts);
  } finally {
    await browser.close();
  }

  const finishedAt = new Date().toISOString();
  const paths = await writeManifest(
    options.artifactDir,
    createAccountActivityManifest({
      runId,
      createdAt,
      startedAt,
      finishedAt,
      exchangeCount,
      oldBaseUrl: options.oldBaseUrl,
      newBaseUrl: options.newBaseUrl,
      scenario,
    }),
  );

  return {
    runId,
    runDir: paths.runDir,
    manifestPath: paths.manifestPath,
    exchangesPath: paths.exchangesPath,
    exchangeCount,
  };
}

async function captureSide(
  browser: Browser,
  side: ApiSide,
  baseUrl: string,
  scenario: CaptureScenario,
  runId: string,
  artifactDir: string,
  prompts: AccountActivityLayerACapturePrompts,
): Promise<number> {
  const context = await browser.newContext();
  let count = 0;
  const pending: Array<Promise<void>> = [];

  try {
    const page = await context.newPage();
    page.on("response", (response) => {
      if (!isAccountActivityApiUrl(side, response.url(), scenario)) return;
      const task = captureResponse(response, page, side, scenario, runId, artifactDir).then((captured) => {
        if (captured) count += 1;
      });
      pending.push(task);
    });

    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const pagePath = side === "old" ? scenario.page.oldPath : scenario.page.newPath;
    const ready = await prompts.confirm(
      `Log in to the ${side} local site if needed, then confirm to capture ${pagePath}.`,
    );
    if (!ready) {
      throw new Error(`Cancelled ${side} account-activity capture before navigation.`);
    }

    prompts.notify?.(`Capturing ${side} ${pagePath}`);
    await page.goto(getAccountActivityCaptureUrl(baseUrl, side, scenario), { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(1_500);
    await Promise.all(pending);
    return count;
  } finally {
    await context.close();
  }
}

async function captureResponse(
  response: Response,
  page: Page,
  side: ApiSide,
  scenario: CaptureScenario,
  runId: string,
  artifactDir: string,
): Promise<boolean> {
  const startedAt = new Date();
  const request = response.request();
  const exchange: ApiExchange = {
    runId,
    layer: "browser-visible",
    side,
    scenarioId: scenario.id,
    request: {
      method: request.method(),
      url: request.url(),
      headers: request.headers(),
      body: parseMaybeJson(request.postData(), request.headers()["content-type"]),
    },
    response: {
      status: response.status(),
      headers: response.headers(),
      body: await readResponseBody(response),
    },
    timing: {
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
    },
    provenance: {
      source: "playwright",
      pageUrl: page.url(),
    },
  };

  await appendExchange(artifactDir, sanitizeExchange(exchange));
  return true;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers()["content-type"];
  try {
    return parseMaybeJson(await response.text(), contentType);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { unavailable: true, reason: message };
  }
}

function parseMaybeJson(value: string | null, contentType?: string): unknown {
  if (!value) return null;
  if (contentType?.toLowerCase().includes("json")) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}
