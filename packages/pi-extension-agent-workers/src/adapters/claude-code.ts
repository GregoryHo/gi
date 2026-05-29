import type { WorkerAdapter } from "../worker-types.ts";
import { textPreview, toNumber, type WorkerEvent, type WorkerUsage } from "../worker-events.ts";
import { isCommandAvailable, type CommandAvailabilityCheck } from "./cli-utils.ts";

interface ClaudeCodeAdapterOptions {
  executable?: string;
  isCommandAvailable?: CommandAvailabilityCheck;
}

export function createClaudeCodeAdapter(options: ClaudeCodeAdapterOptions = {}): WorkerAdapter {
  const executable = options.executable ?? "claude";
  const commandAvailable = options.isCommandAvailable ?? isCommandAvailable;

  return {
    name: "claude-code",
    validate() {
      if (!commandAvailable(executable)) {
        throw new Error(`Claude Code CLI not found: ${executable}`);
      }
    },
    createSpawnSpec(task, cwd) {
      return {
        command: executable,
        args: ["-p", "--verbose", "--no-session-persistence", "--output-format", "stream-json", task],
        cwd,
        shell: false,
      };
    },
    parseOutputLine(line, stream, timestamp) {
      if (stream !== "stdout") return [{ type: "output", stream, text: line, timestamp }];
      return parseClaudeCodeStreamLine(line, timestamp);
    },
  };
}


export function parseClaudeCodeStreamLine(line: string, timestamp = Date.now()): WorkerEvent[] {
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return [{ type: "output", stream: "stdout", text: line, timestamp }];
  }

  const type = event.type;
  if (type === "assistant") return parseAssistantEvent(event, timestamp);
  if (type === "result") return parseResultEvent(event, timestamp);
  if (type === "system") return parseSystemEvent(event, timestamp);
  return [{ type: "activity", label: `claude event: ${String(type ?? "unknown")}`, timestamp }];
}

function parseAssistantEvent(event: Record<string, unknown>, timestamp: number): WorkerEvent[] {
  const message = asRecord(event.message);
  const events: WorkerEvent[] = [];
  const text = extractTextContent(message?.content);
  if (text) events.push({ type: "final", text: textPreview(text), timestamp });

  const usage = claudeUsageFromRecord(asRecord(message?.usage));
  if (usage) events.push({ type: "usage", usage, timestamp });
  return events.length > 0 ? events : [{ type: "activity", label: "claude assistant event", timestamp }];
}

function parseResultEvent(event: Record<string, unknown>, timestamp: number): WorkerEvent[] {
  const subtype = typeof event.subtype === "string" ? event.subtype : "unknown";
  const events: WorkerEvent[] = [{ type: "activity", label: `claude result: ${subtype}`, timestamp }];
  const usage = claudeUsageFromRecord(asRecord(event.usage), toNumber(event.total_cost_usd));
  if (usage) events.push({ type: "usage", usage, timestamp });
  return events;
}

function parseSystemEvent(event: Record<string, unknown>, timestamp: number): WorkerEvent[] {
  const subtype = typeof event.subtype === "string" ? event.subtype : "system";
  return [{ type: "activity", label: `claude system: ${subtype}`, timestamp }];
}

function claudeUsageFromRecord(record: Record<string, unknown> | undefined, costUsd?: number): WorkerUsage | undefined {
  if (!record) return undefined;
  const usage: WorkerUsage = { source: "reported" };
  const inputTokens = toNumber(record.input_tokens);
  const outputTokens = toNumber(record.output_tokens);
  const cacheReadTokens = toNumber(record.cache_read_input_tokens);
  const cacheWriteTokens = toNumber(record.cache_creation_input_tokens);
  if (inputTokens !== undefined) usage.inputTokens = inputTokens;
  if (outputTokens !== undefined) usage.outputTokens = outputTokens;
  if (cacheReadTokens !== undefined) usage.cacheReadTokens = cacheReadTokens;
  if (cacheWriteTokens !== undefined) usage.cacheWriteTokens = cacheWriteTokens;
  if (costUsd !== undefined) usage.costUsd = costUsd;
  return hasUsageValue(usage) ? usage : undefined;
}

function hasUsageValue(usage: WorkerUsage): boolean {
  return [usage.inputTokens, usage.outputTokens, usage.cacheReadTokens, usage.cacheWriteTokens, usage.costUsd].some(
    (value) => value !== undefined,
  );
}

function extractTextContent(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined;
  const text = content
    .map((part) => asRecord(part))
    .filter((part): part is Record<string, unknown> => Boolean(part) && part?.type === "text")
    .map((part) => part.text)
    .filter((text): text is string => typeof text === "string")
    .join("\n")
    .trim();
  return text || undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}
