import { createServer, type IncomingHttpHeaders, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { appendExchange, createRunId, getRunPaths, writeManifest } from "./artifacts.ts";
import { REDACTED, REDACTION_POLICY, sanitizeExchange } from "../core/redaction.ts";
import type { ApiExchange, ApiSide, BrowserVisibleApiObservation, CandidatePageContext, CaptureManifest } from "../types.ts";

export interface RecordingProxyPassthroughRoute {
  pathPrefix: string;
  targetBaseUrl: string;
}

export interface StartRecordingProxyOptions {
  side: ApiSide;
  listenHost: string;
  listenPort: number;
  targetBaseUrl: string;
  artifactDir: string;
  scenarioId: string;
  targetId?: string;
  variant?: string;
  purpose?: string;
  candidateScenarioId?: string;
  discoverySessionId?: string;
  comparisonRunId?: string;
  record?: boolean;
  passthroughRoutes?: RecordingProxyPassthroughRoute[];
}

export interface RecordingWindowOptions {
  scenarioId: string;
  targetId?: string;
  variant?: string;
  purpose?: string;
  candidateScenarioId?: string;
  discoverySessionId?: string;
  comparisonRunId?: string;
}

export interface FinishRecordingWindowOptions {
  candidatePage?: CandidatePageContext;
  browserVisibleRequests?: BrowserVisibleApiObservation[];
}

export interface RecordingWindowHandle {
  runId: string;
  manifestPath: string;
  exchangesPath: string;
  exchangeCount: number;
  candidatePage?: CandidatePageContext;
  finish(options?: FinishRecordingWindowOptions): Promise<void>;
}

export interface RecordingProxyHandle {
  runId: string;
  listenUrl: string;
  manifestPath: string;
  exchangesPath: string;
  exchangeCount: number;
  recording?: boolean;
  setRecording?(recording: boolean): Promise<void>;
  beginRecordingWindow?(options: RecordingWindowOptions): Promise<RecordingWindowHandle>;
  stop(): Promise<void>;
}

interface ActiveRecordingRun {
  runId: string;
  createdAt: string;
  scenarioId: string;
  targetId?: string;
  variant?: string;
  purpose?: string;
  candidateScenarioId?: string;
  discoverySessionId?: string;
  comparisonRunId?: string;
  recordingWindow?: { startedAt: string; finishedAt?: string };
  candidatePage?: CandidatePageContext;
  browserVisibleRequests?: BrowserVisibleApiObservation[];
  exchangeCount: number;
}

export async function startRecordingProxy(options: StartRecordingProxyOptions): Promise<RecordingProxyHandle> {
  let activeRun: ActiveRecordingRun = createActiveRun(options);
  let recording = options.record !== false;
  let stopped = false;
  let listenUrl = "";

  const server = createServer(async (request, response) => {
    try {
      await handleProxyRequest(
        request,
        response,
        options,
        () => activeRun,
        listenUrl,
        () => recording,
        async () => {
          activeRun.exchangeCount += 1;
          await writeManifest(
            options.artifactDir,
            createProxyManifest({ ...options, ...activeRun, listenUrl, recording }),
          );
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!response.headersSent) response.writeHead(502, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "recording proxy failed", message }));
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.listenPort, options.listenHost, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Recording proxy did not bind to a TCP port.");
  listenUrl = `http://${options.listenHost}:${address.port}`;

  const paths = await writeManifest(options.artifactDir, createProxyManifest({ ...options, ...activeRun, listenUrl, recording }));

  return {
    get runId() {
      return activeRun.runId;
    },
    listenUrl,
    get manifestPath() {
      return getRunPaths(options.artifactDir, activeRun.runId).manifestPath;
    },
    get exchangesPath() {
      return getRunPaths(options.artifactDir, activeRun.runId).exchangesPath;
    },
    get exchangeCount() {
      return activeRun.exchangeCount;
    },
    get recording() {
      return recording;
    },
    setRecording: async (next) => {
      recording = next;
      await writeManifest(options.artifactDir, createProxyManifest({ ...options, ...activeRun, listenUrl, recording }));
    },
    beginRecordingWindow: async (windowOptions) => {
      activeRun = createActiveRun({ ...options, ...windowOptions }, { recordingWindow: { startedAt: new Date().toISOString() } });
      recording = true;
      const windowPaths = await writeManifest(
        options.artifactDir,
        createProxyManifest({ ...options, ...activeRun, listenUrl, recording }),
      );
      const windowRun = activeRun;
      return {
        runId: windowRun.runId,
        manifestPath: windowPaths.manifestPath,
        exchangesPath: windowPaths.exchangesPath,
        get exchangeCount() {
          return windowRun.exchangeCount;
        },
        get candidatePage() {
          return windowRun.candidatePage;
        },
        finish: async (finishOptions = {}) => {
          if (finishOptions.candidatePage) windowRun.candidatePage = finishOptions.candidatePage;
          if (finishOptions.browserVisibleRequests) windowRun.browserVisibleRequests = finishOptions.browserVisibleRequests;
          if (activeRun === windowRun) {
            recording = false;
            activeRun.recordingWindow = { ...windowRun.recordingWindow, finishedAt: new Date().toISOString() } as {
              startedAt: string;
              finishedAt: string;
            };
            await writeManifest(
              options.artifactDir,
              createProxyManifest({ ...options, ...activeRun, listenUrl, recording, finishedAt: new Date().toISOString() }),
            );
          }
        },
      };
    },
    stop: async () => {
      if (stopped) return;
      stopped = true;
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      await writeManifest(
        options.artifactDir,
        createProxyManifest({
          ...options,
          ...activeRun,
          listenUrl,
          recording,
          finishedAt: new Date().toISOString(),
        }),
      );
    },
  };
}

function createActiveRun(
  options: Pick<StartRecordingProxyOptions, "scenarioId" | "targetId" | "variant" | "purpose" | "candidateScenarioId" | "discoverySessionId" | "comparisonRunId">,
  extras: { recordingWindow?: { startedAt: string; finishedAt?: string } } = {},
): ActiveRecordingRun {
  return {
    runId: createRunId(),
    createdAt: new Date().toISOString(),
    scenarioId: options.scenarioId,
    ...(options.targetId ? { targetId: options.targetId } : {}),
    ...(options.variant ? { variant: options.variant } : {}),
    ...(options.purpose ? { purpose: options.purpose } : {}),
    ...(options.candidateScenarioId ? { candidateScenarioId: options.candidateScenarioId } : {}),
    ...(options.discoverySessionId ? { discoverySessionId: options.discoverySessionId } : {}),
    ...(options.comparisonRunId ? { comparisonRunId: options.comparisonRunId } : {}),
    ...(extras.recordingWindow ? { recordingWindow: extras.recordingWindow } : {}),
    exchangeCount: 0,
  };
}

function createProxyManifest(input: StartRecordingProxyOptions & ActiveRecordingRun & {
  listenUrl: string;
  recording: boolean;
  finishedAt?: string;
}): CaptureManifest {
  return {
    runId: input.runId,
    createdAt: input.createdAt,
    artifactVersion: 1,
    redaction: { marker: REDACTED, policy: REDACTION_POLICY },
    scenarios: [input.scenarioId],
    layer: "upstream",
    ...(input.purpose ? { purpose: input.purpose } : {}),
    ...(input.candidateScenarioId ? { candidateScenarioId: input.candidateScenarioId } : {}),
    ...(input.discoverySessionId ? { discoverySessionId: input.discoverySessionId } : {}),
    ...(input.comparisonRunId ? { comparisonRunId: input.comparisonRunId } : {}),
    ...(input.recordingWindow ? { recordingWindow: input.recordingWindow } : {}),
    ...(input.candidatePage ? { candidatePage: input.candidatePage } : {}),
    ...(input.browserVisibleRequests ? { browserVisibleRequests: input.browserVisibleRequests } : {}),
    startedAt: input.createdAt,
    ...(input.finishedAt ? { finishedAt: input.finishedAt } : {}),
    exchangeCount: input.exchangeCount,
    recording: input.recording,
    recordingProxy: {
      side: input.side,
      listenUrl: input.listenUrl,
      targetBaseUrl: input.targetBaseUrl,
      scenarioId: input.scenarioId,
      ...(input.targetId ? { targetId: input.targetId } : {}),
      ...(input.variant ? { variant: input.variant } : {}),
    },
    notes: ["Layer B recording proxy spike; local curl validation before app integration."],
  };
}

async function handleProxyRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: StartRecordingProxyOptions,
  getActiveRun: () => ActiveRecordingRun,
  listenUrl: string,
  shouldRecord: () => boolean,
  recordCapture: () => Promise<void>,
): Promise<void> {
  const startedAt = new Date();
  const requestBodyBuffer = await readRequestBody(request);
  const route = selectProxyRoute(request.url ?? "/", options);
  const targetUrl = new URL(request.url ?? "/", `${route.targetBaseUrl}/`);
  const requestHeaders = normalizeIncomingHeaders(request.headers);

  const requestBody = shouldForwardBody(request.method) ? (requestBodyBuffer as unknown as BodyInit) : undefined;
  const upstreamResponse = await fetch(targetUrl, {
    method: request.method,
    headers: filterForwardRequestHeaders(requestHeaders),
    body: requestBody,
  });
  const responseBodyBuffer = Buffer.from(await upstreamResponse.arrayBuffer());
  const responseHeaders = Object.fromEntries(upstreamResponse.headers.entries());

  const activeRun = getActiveRun();
  const exchange: ApiExchange = {
    runId: activeRun.runId,
    layer: "upstream",
    side: options.side,
    scenarioId: activeRun.scenarioId,
    ...(activeRun.targetId ? { targetId: activeRun.targetId } : {}),
    ...(activeRun.variant ? { variant: activeRun.variant } : {}),
    request: {
      method: request.method ?? "GET",
      url: `${listenUrl}${request.url ?? "/"}`,
      headers: requestHeaders,
      body: parseMaybeJson(requestBodyBuffer.toString("utf8"), requestHeaders["content-type"]),
    },
    response: {
      status: upstreamResponse.status,
      headers: responseHeaders,
      body: parseMaybeJson(responseBodyBuffer.toString("utf8"), responseHeaders["content-type"]),
    },
    timing: {
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
    },
    provenance: {
      source: "recording-proxy",
    },
  };

  if (route.record && shouldRecord()) {
    await appendExchange(options.artifactDir, sanitizeExchange(exchange));
    await recordCapture();
  }
  response.writeHead(upstreamResponse.status, filterClientResponseHeaders(responseHeaders));
  response.end(responseBodyBuffer);
}

interface SelectedProxyRoute {
  targetBaseUrl: string;
  record: boolean;
}

function selectProxyRoute(requestUrl: string, options: StartRecordingProxyOptions): SelectedProxyRoute {
  const requestPath = new URL(requestUrl, `${options.targetBaseUrl}/`).pathname;
  const passthrough = [...(options.passthroughRoutes ?? [])]
    .sort((left, right) => right.pathPrefix.length - left.pathPrefix.length)
    .find((route) => requestPath.startsWith(route.pathPrefix));
  if (passthrough) return { targetBaseUrl: passthrough.targetBaseUrl, record: false };
  return { targetBaseUrl: options.targetBaseUrl, record: true };
}

function readRequestBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function normalizeIncomingHeaders(headers: IncomingHttpHeaders): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers)
      .filter((entry): entry is [string, string | string[]] => entry[1] !== undefined)
      .map(([key, value]) => [key.toLowerCase(), Array.isArray(value) ? value.join(", ") : value]),
  );
}

function filterForwardRequestHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(([key]) => !["host", "connection", "content-length"].includes(key)),
  );
}

function filterClientResponseHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(
      ([key]) => !["connection", "content-encoding", "content-length", "transfer-encoding"].includes(key),
    ),
  );
}

function shouldForwardBody(method = "GET"): boolean {
  return method !== "GET" && method !== "HEAD";
}

function parseMaybeJson(value: string, contentType?: string): unknown {
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
