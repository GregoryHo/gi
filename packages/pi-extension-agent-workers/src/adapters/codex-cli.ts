import type { ProcessWorkerAdapter } from "../core/worker-types.ts";
import { textPreview, toNumber, type WorkerEvent, type WorkerUsage } from "../core/worker-events.ts";
import { isCommandAvailable, type CommandAvailabilityCheck } from "./cli-utils.ts";

interface CodexCliAdapterOptions {
  executable?: string;
  isCommandAvailable?: CommandAvailabilityCheck;
}

export function createCodexCliAdapter(options: CodexCliAdapterOptions = {}): ProcessWorkerAdapter {
  const executable = options.executable ?? "codex";
  const commandAvailable = options.isCommandAvailable ?? isCommandAvailable;

  return {
    name: "codex-cli",
    validate() {
      if (!commandAvailable(executable)) {
        throw new Error(`Codex CLI not found: ${executable}`);
      }
    },
    createSpawnSpec(task, cwd) {
      return { command: executable, args: ["exec", "--json", task], cwd, shell: false };
    },
    parseOutputLine(line, stream, timestamp) {
      if (stream !== "stdout") return [{ type: "output", stream, text: line, timestamp }];
      return parseCodexCliJsonLine(line, timestamp);
    },
  };
}


export function parseCodexCliJsonLine(line: string, timestamp = Date.now()): WorkerEvent[] {
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return [{ type: "output", stream: "stdout", text: line, timestamp }];
  }

  if (event.type === "thread.started") return [{ type: "activity", label: "codex thread started", timestamp }];
  if (event.type === "turn.started") return [{ type: "activity", label: "codex turn started", timestamp }];
  if (event.type === "turn.completed") return parseTurnCompleted(event, timestamp);
  if (event.type === "item.completed") return parseItemCompleted(event, timestamp);
  return [{ type: "activity", label: `codex event: ${String(event.type ?? "unknown")}`, timestamp }];
}

function parseTurnCompleted(event: Record<string, unknown>, timestamp: number): WorkerEvent[] {
  const events: WorkerEvent[] = [{ type: "activity", label: "codex turn completed", timestamp }];
  const usage = codexUsageFromRecord(asRecord(event.usage));
  if (usage) events.push({ type: "usage", usage, timestamp });
  return events;
}

function parseItemCompleted(event: Record<string, unknown>, timestamp: number): WorkerEvent[] {
  const item = asRecord(event.item);
  if (item?.type === "agent_message" && typeof item.text === "string") {
    return [{ type: "final", text: textPreview(item.text), timestamp }];
  }
  const itemType = typeof item?.type === "string" ? item.type : "unknown";
  return [{ type: "activity", label: `codex item completed: ${itemType}`, timestamp }];
}

function codexUsageFromRecord(record: Record<string, unknown> | undefined): WorkerUsage | undefined {
  if (!record) return undefined;
  const usage: WorkerUsage = {
    inputTokens: toNumber(record.input_tokens),
    outputTokens: toNumber(record.output_tokens),
    cacheReadTokens: toNumber(record.cached_input_tokens),
    reasoningOutputTokens: toNumber(record.reasoning_output_tokens),
    source: "reported",
  };
  return hasUsageValue(usage) ? usage : undefined;
}

function hasUsageValue(usage: WorkerUsage): boolean {
  return [usage.inputTokens, usage.outputTokens, usage.cacheReadTokens, usage.reasoningOutputTokens].some(
    (value) => value !== undefined,
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}
