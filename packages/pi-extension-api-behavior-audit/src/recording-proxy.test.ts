import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { startRecordingProxy } from "./recording-proxy.ts";
import type { ApiExchange, CaptureManifest } from "./types.ts";

test("recording proxy can create isolated recording windows without stopping server", async () => {
  const upstream = createServer((_request, response) => {
    response.statusCode = 200;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ ok: true }));
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const upstreamAddress = upstream.address();
  assert.ok(upstreamAddress && typeof upstreamAddress === "object");

  const artifactDir = await mkdtemp(join(tmpdir(), "api-audit-proxy-window-"));
  const proxy = await startRecordingProxy({
    side: "new",
    targetId: "candidate",
    variant: "candidate",
    listenHost: "127.0.0.1",
    listenPort: 0,
    targetBaseUrl: `http://127.0.0.1:${upstreamAddress.port}`,
    artifactDir,
    scenarioId: "discovery-session",
    purpose: "scenario-discovery",
    record: false,
  });

  try {
    await fetch(`${proxy.listenUrl}/before-window`);
    const windowA = await proxy.beginRecordingWindow?.({
      scenarioId: "scenario-a",
      candidateScenarioId: "scenario-a",
      discoverySessionId: "discovery-abc",
      comparisonRunId: "comparison-abc",
      purpose: "scenario-discovery",
    });
    assert.ok(windowA);
    await fetch(`${proxy.listenUrl}/scenario-a`);
    await windowA.finish({
      candidatePage: {
        url: "http://localhost:8008/account/activity",
        path: "/account/activity",
        source: "playwright-page-url",
      },
      browserVisibleRequests: [
        {
          method: "GET",
          url: "http://localhost:8008/gateway/apis/account/activity",
          path: "/gateway/apis/account/activity",
          status: 200,
          source: "playwright-response",
        },
      ],
    });

    await fetch(`${proxy.listenUrl}/between-windows`);
    const windowB = await proxy.beginRecordingWindow?.({
      scenarioId: "scenario-b",
      candidateScenarioId: "scenario-b",
      discoverySessionId: "discovery-abc",
      purpose: "scenario-discovery",
    });
    assert.ok(windowB);
    await fetch(`${proxy.listenUrl}/scenario-b`);
    await windowB.finish();

    const manifestA = JSON.parse(await readFile(windowA.manifestPath, "utf8")) as CaptureManifest;
    const manifestB = JSON.parse(await readFile(windowB.manifestPath, "utf8")) as CaptureManifest;
    const exchangesA = (await readFile(windowA.exchangesPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line) as ApiExchange);
    const exchangesB = (await readFile(windowB.exchangesPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line) as ApiExchange);

    assert.notEqual(windowA.runId, windowB.runId);
    assert.equal(manifestA.candidateScenarioId, "scenario-a");
    assert.equal(manifestA.discoverySessionId, "discovery-abc");
    assert.equal(manifestA.comparisonRunId, "comparison-abc");
    assert.equal(manifestA.recordingWindow?.finishedAt !== undefined, true);
    assert.equal(manifestA.candidatePage?.path, "/account/activity");
    assert.equal(manifestA.browserVisibleRequests?.[0]?.path, "/gateway/apis/account/activity");
    assert.equal(manifestB.candidateScenarioId, "scenario-b");
    assert.equal(exchangesA.length, 1);
    assert.equal(exchangesA[0].scenarioId, "scenario-a");
    assert.match(exchangesA[0].request.url, /scenario-a/);
    assert.equal(exchangesB.length, 1);
    assert.equal(exchangesB[0].scenarioId, "scenario-b");
    assert.match(exchangesB[0].request.url, /scenario-b/);
  } finally {
    await proxy.stop();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  }
});

test("recording proxy can forward while paused and record after being armed", async () => {
  const upstream = createServer((_request, response) => {
    response.statusCode = 200;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ ok: true }));
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const upstreamAddress = upstream.address();
  assert.ok(upstreamAddress && typeof upstreamAddress === "object");

  const artifactDir = await mkdtemp(join(tmpdir(), "api-audit-proxy-paused-"));
  const proxy = await startRecordingProxy({
    side: "new",
    listenHost: "127.0.0.1",
    listenPort: 0,
    targetBaseUrl: `http://127.0.0.1:${upstreamAddress.port}`,
    artifactDir,
    scenarioId: "paused-discovery",
    record: false,
  });

  try {
    assert.equal(proxy.recording, false);
    assert.equal((await fetch(`${proxy.listenUrl}/bootstrap`)).status, 200);
    assert.equal(proxy.exchangeCount, 0);

    await proxy.setRecording?.(true);
    assert.equal(proxy.recording, true);
    assert.equal((await fetch(`${proxy.listenUrl}/target-action`)).status, 200);
    assert.equal(proxy.exchangeCount, 1);

    await proxy.stop();
    const exchangesRaw = await readFile(proxy.exchangesPath, "utf8");
    const exchanges = exchangesRaw.trim().split("\n").map((line) => JSON.parse(line) as ApiExchange);
    assert.equal(exchanges.length, 1);
    assert.match(exchanges[0].request.url, /target-action/);
  } finally {
    await proxy.stop();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  }
});

test("recording proxy writes optional target metadata", async () => {
  const upstream = createServer((_request, response) => {
    response.statusCode = 200;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ ok: true }));
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const upstreamAddress = upstream.address();
  assert.ok(upstreamAddress && typeof upstreamAddress === "object");

  const artifactDir = await mkdtemp(join(tmpdir(), "api-audit-proxy-target-"));
  const proxy = await startRecordingProxy({
    side: "new",
    targetId: "candidate",
    variant: "candidate",
    listenHost: "127.0.0.1",
    listenPort: 0,
    targetBaseUrl: `http://127.0.0.1:${upstreamAddress.port}`,
    artifactDir,
    scenarioId: "account-activity-basic",
  });

  try {
    const response = await fetch(`${proxy.listenUrl}/apis/account/activity`);
    assert.equal(response.status, 200);
    await proxy.stop();

    const manifest = JSON.parse(await readFile(proxy.manifestPath, "utf8")) as CaptureManifest;
    const exchangesRaw = await readFile(proxy.exchangesPath, "utf8");
    const exchange = JSON.parse(exchangesRaw.trim()) as ApiExchange;

    assert.equal(manifest.recordingProxy?.targetId, "candidate");
    assert.equal(manifest.recordingProxy?.variant, "candidate");
    assert.equal(exchange.targetId, "candidate");
    assert.equal(exchange.variant, "candidate");
  } finally {
    await proxy.stop();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  }
});

test("recording proxy forwards requests and writes sanitized upstream exchanges", async () => {
  const upstream = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      response.statusCode = 201;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          method: request.method,
          url: request.url,
          authorization: request.headers.authorization,
          body: Buffer.concat(chunks).toString("utf8"),
          nextToken: "response-token-to-hide",
        }),
      );
    });
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const upstreamAddress = upstream.address();
  assert.ok(upstreamAddress && typeof upstreamAddress === "object");

  const artifactDir = await mkdtemp(join(tmpdir(), "api-audit-proxy-"));
  const proxy = await startRecordingProxy({
    side: "old",
    listenHost: "127.0.0.1",
    listenPort: 0,
    targetBaseUrl: `http://127.0.0.1:${upstreamAddress.port}`,
    artifactDir,
    scenarioId: "recording-proxy-spike",
  });

  try {
    const response = await fetch(`${proxy.listenUrl}/v1/server-time?token=request-token-to-hide`, {
      method: "POST",
      headers: {
        authorization: "Bearer request-token-to-hide",
        "content-type": "application/json",
      },
      body: JSON.stringify({ password: "request-password-to-hide", safe: "ok" }),
    });

    assert.equal(response.status, 201);
    const responseBody = await response.json() as { url: string; authorization: string; body: string };
    assert.equal(responseBody.url, "/v1/server-time?token=request-token-to-hide");
    assert.equal(responseBody.authorization, "Bearer request-token-to-hide");
    assert.match(responseBody.body, /request-password-to-hide/);

    const liveManifest = JSON.parse(await readFile(proxy.manifestPath, "utf8")) as CaptureManifest;
    assert.equal(liveManifest.exchangeCount, 1);

    await proxy.stop();
    const manifest = JSON.parse(await readFile(proxy.manifestPath, "utf8")) as CaptureManifest;
    const exchangesRaw = await readFile(proxy.exchangesPath, "utf8");
    const exchanges = exchangesRaw.trim().split("\n").map((line) => JSON.parse(line) as ApiExchange);

    assert.equal(manifest.layer, "upstream");
    assert.deepEqual(manifest.scenarios, ["recording-proxy-spike"]);
    assert.equal(manifest.exchangeCount, 1);
    assert.equal(exchanges.length, 1);

    const exchange = exchanges[0];
    assert.equal(exchange.layer, "upstream");
    assert.equal(exchange.side, "old");
    assert.equal(exchange.scenarioId, "recording-proxy-spike");
    assert.equal(exchange.provenance.source, "recording-proxy");
    assert.equal(exchange.response.status, 201);

    const serialized = JSON.stringify(exchange);
    assert.equal(serialized.includes("request-token-to-hide"), false);
    assert.equal(serialized.includes("request-password-to-hide"), false);
    assert.equal(serialized.includes("response-token-to-hide"), false);
    assert.equal(exchange.request.headers.authorization, "[REDACTED]");
  } finally {
    await proxy.stop();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  }
});
