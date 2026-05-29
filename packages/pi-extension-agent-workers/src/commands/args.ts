import type { WorkerAdapterName } from "../request-types.ts";

const MAX_DEMO_DURATION_MS = 60_000;
const MAX_WORKER_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const MAX_WAIT_MS = 24 * 60 * 60 * 1000;

export type ParsedWorkerRunArgs =
  | {
      ok: true;
      adapter?: WorkerAdapterName;
      profile?: string;
      task: string;
      durationMs?: number;
      timeoutMs?: number;
      cwd?: string;
      pickCwd?: boolean;
      confirmedRealWorker?: boolean;
    }
  | { ok: false; message: string };

export type ParsedWorkerWaitArgs =
  | { ok: true; runId: string; waitMs?: number }
  | { ok: false; message: string };

export type ParsedWorkerHistoryArgs =
  | { ok: true; limit?: number; allScopes?: boolean }
  | { ok: false; message: string };

export function parseWorkerRunArgs(args: string): ParsedWorkerRunArgs {
  const trimmed = args.trim();
  if (!trimmed) return workerRunUsage();

  const parts = trimmed.split(/\s+/);
  let adapter: string | undefined;
  let profile: string | undefined;
  let durationMs: number | undefined;
  let timeoutMs: number | undefined;
  let cwd: string | undefined;
  let pickCwd = false;
  let confirmedRealWorker = false;
  let index = 0;

  while (index < parts.length) {
    const flag = parts[index];
    if (flag === "--adapter") {
      adapter = parts[index + 1] ?? "";
      index += 2;
      continue;
    }
    if (flag === "--profile") {
      profile = parts[index + 1] ?? "";
      index += 2;
      continue;
    }
    if (flag === "--yes") {
      confirmedRealWorker = true;
      index += 1;
      continue;
    }
    if (flag === "--cwd") {
      cwd = parts[index + 1] ?? "";
      if (!cwd) return { ok: false, message: "--cwd requires a path." };
      index += 2;
      continue;
    }
    if (flag === "--pick-cwd") {
      pickCwd = true;
      index += 1;
      continue;
    }
    if (flag === "--duration-ms") {
      const rawDuration = parts[index + 1] ?? "";
      durationMs = Number(rawDuration);
      if (!Number.isInteger(durationMs) || durationMs < 1 || durationMs > MAX_DEMO_DURATION_MS) {
        return { ok: false, message: `--duration-ms must be between 1 and ${MAX_DEMO_DURATION_MS}.` };
      }
      index += 2;
      continue;
    }
    if (flag === "--timeout-ms") {
      const rawTimeout = parts[index + 1] ?? "";
      timeoutMs = Number(rawTimeout);
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_WORKER_TIMEOUT_MS) {
        return { ok: false, message: `--timeout-ms must be between 1 and ${MAX_WORKER_TIMEOUT_MS}.` };
      }
      index += 2;
      continue;
    }
    break;
  }

  if (adapter !== undefined && !isWorkerAdapterName(adapter)) {
    return { ok: false, message: `Unknown adapter: ${adapter}. Available adapters: demo, claude-code, codex-cli.` };
  }

  const task = parts.slice(index).join(" ").trim();
  if (!task) return workerRunUsage();
  return {
    ok: true,
    ...(adapter === undefined && profile === undefined ? { adapter: "demo" as const } : {}),
    ...(adapter === undefined ? {} : { adapter }),
    ...(profile === undefined ? {} : { profile }),
    task,
    ...(durationMs === undefined ? {} : { durationMs }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
    ...(cwd === undefined ? {} : { cwd }),
    ...(pickCwd ? { pickCwd } : {}),
    ...(confirmedRealWorker ? { confirmedRealWorker } : {}),
  };
}

export function parseWorkerHistoryArgs(args: string): ParsedWorkerHistoryArgs {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  let limit: number | undefined;
  let allScopes = false;
  let index = 0;
  while (index < parts.length) {
    const flag = parts[index];
    if (flag === "--all") {
      allScopes = true;
      index += 1;
      continue;
    }
    if (flag === "--limit") {
      const rawLimit = parts[index + 1] ?? "";
      limit = Number(rawLimit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        return { ok: false, message: "--limit must be between 1 and 100." };
      }
      index += 2;
      continue;
    }
    return { ok: false, message: `Unknown worker-history option: ${flag}` };
  }
  return { ok: true, ...(limit === undefined ? {} : { limit }), ...(allScopes ? { allScopes } : {}) };
}

export function parseWorkerWaitArgs(args: string): ParsedWorkerWaitArgs {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  const runId = parts[0] ?? "";
  if (!runId || runId.startsWith("--")) return workerWaitUsage();

  let waitMs: number | undefined;
  let index = 1;
  while (index < parts.length) {
    const flag = parts[index];
    if (flag === "--wait-ms") {
      const rawWait = parts[index + 1] ?? "";
      waitMs = Number(rawWait);
      if (!Number.isInteger(waitMs) || waitMs < 1 || waitMs > MAX_WAIT_MS) {
        return { ok: false, message: `--wait-ms must be between 1 and ${MAX_WAIT_MS}.` };
      }
      index += 2;
      continue;
    }
    return { ok: false, message: `Unknown worker-wait option: ${flag}` };
  }

  return { ok: true, runId, ...(waitMs === undefined ? {} : { waitMs }) };
}

function isWorkerAdapterName(adapter: string): adapter is WorkerAdapterName {
  return adapter === "demo" || adapter === "claude-code" || adapter === "codex-cli";
}

function workerRunUsage(): ParsedWorkerRunArgs {
  return {
    ok: false,
    message: "Usage: /worker-run [--cwd <path>] [--pick-cwd] [--adapter demo|claude-code|codex-cli] [--profile planner|reviewer|implementer|verifier] [--duration-ms 10000] [--timeout-ms <ms>] [--yes] <task>",
  };
}

function workerWaitUsage(): ParsedWorkerWaitArgs {
  return {
    ok: false,
    message: "Usage: /worker-wait <id> [--wait-ms <ms>]",
  };
}
