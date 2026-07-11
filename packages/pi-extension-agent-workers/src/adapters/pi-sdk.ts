import {
  createAgentSession,
  createExtensionRuntime,
  type ResourceLoader,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

import type { AsyncWorkerAdapter, AsyncWorkerRunContext } from "../core/worker-types.ts";
import { textPreview, toNumber, type WorkerEvent, type WorkerUsage } from "../core/worker-events.ts";

const READ_ONLY_TOOLS = ["read", "grep", "find", "ls"];
const WRITE_CAPABLE_TOOLS = ["read", "grep", "find", "ls", "bash", "edit", "write"];

interface PiSdkSessionLike {
  prompt(text: string): Promise<void>;
  subscribe(listener: (event: unknown) => void): () => void;
  abort(): Promise<void>;
  dispose(): void;
}

interface PiSdkCreateSessionOptions {
  cwd: string;
  tools: string[];
}

interface PiSdkAdapterOptions {
  createSession?: (options: PiSdkCreateSessionOptions) => Promise<{ session: PiSdkSessionLike }>;
  now?: () => number;
}

export function createPiSdkAdapter(options: PiSdkAdapterOptions = {}): AsyncWorkerAdapter {
  const now = options.now ?? (() => Date.now());
  return {
    name: "pi-sdk",
    async runTask(context) {
      const tools = selectTools(context);
      const { session } = await (options.createSession ?? createDefaultSession)({ cwd: context.cwd, tools });
			const unsubscribe = session.subscribe((event) => {
				for (const workerEvent of workerEventsFromSessionEvent(event, now())) {
					if (workerEvent.type === "final" && workerEvent.text) context.writeOutput("stdout", `[final]\n${workerEvent.text}`);
					context.emitEvent(workerEvent);
				}
			});
      const abort = () => {
        void session.abort().catch(() => undefined);
      };
      if (context.signal.aborted) abort();
      else context.signal.addEventListener("abort", abort, { once: true });

      try {
        await session.prompt(context.task);
        context.writeOutput("stdout", "pi-sdk child session completed");
        context.emitEvent({ type: "activity", label: "pi-sdk child session completed", timestamp: now() });
        return { exitCode: 0 };
      } catch (error) {
        context.writeOutput("stderr", error instanceof Error ? error.message : String(error));
        context.emitEvent({ type: "error", message: error instanceof Error ? error.message : String(error), timestamp: now() });
        return { exitCode: 1 };
      } finally {
        context.signal.removeEventListener("abort", abort);
        unsubscribe();
        session.dispose();
      }
    },
  };
}

function selectTools(context: Pick<AsyncWorkerRunContext, "readOnly" | "canModifyWorkspace">): string[] {
  return context.canModifyWorkspace && context.readOnly === false ? [...WRITE_CAPABLE_TOOLS] : [...READ_ONLY_TOOLS];
}

async function createDefaultSession(options: PiSdkCreateSessionOptions): Promise<{ session: PiSdkSessionLike }> {
  return createAgentSession({
    cwd: options.cwd,
    tools: options.tools,
    resourceLoader: createMinimalResourceLoader(),
    sessionManager: SessionManager.inMemory(options.cwd),
  }) as Promise<{ session: PiSdkSessionLike }>;
}

function createMinimalResourceLoader(): ResourceLoader {
  return {
    getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => "You are a delegated pi SDK worker. Complete the task and return a concise final answer.",
    getAppendSystemPrompt: () => [],
    extendResources: () => {},
    reload: async () => {},
  };
}

function workerEventsFromSessionEvent(event: unknown, timestamp: number): WorkerEvent[] {
  const record = asRecord(event);
  if (!record || record.type !== "message_end") return [];
  const message = asRecord(record.message);
  if (!message || message.role !== "assistant") return [];

  const events: WorkerEvent[] = [];
  const text = extractText(message.content);
  if (text) events.push({ type: "final", text, timestamp });

  const usage = usageFromMessage(message);
  if (usage) events.push({ type: "usage", usage, timestamp });
  return events;
}

function extractText(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined;
  const text = content
    .map((part) => asRecord(part))
    .filter((part): part is Record<string, unknown> => Boolean(part) && part?.type === "text")
    .map((part) => part.text)
    .filter((value): value is string => typeof value === "string")
    .join("\n")
    .trim();
  return text || undefined;
}

function usageFromMessage(message: Record<string, unknown>): WorkerUsage | undefined {
  const rawUsage = asRecord(message.usage);
  if (!rawUsage) return undefined;
  const cost = asRecord(rawUsage.cost);
  const usage: WorkerUsage = {
    source: "reported",
    inputTokens: toNumber(rawUsage.input),
    outputTokens: toNumber(rawUsage.output),
    cacheReadTokens: toNumber(rawUsage.cacheRead),
    cacheWriteTokens: toNumber(rawUsage.cacheWrite),
    costUsd: toNumber(cost?.total),
  };
  return [usage.inputTokens, usage.outputTokens, usage.cacheReadTokens, usage.cacheWriteTokens, usage.costUsd].some(
    (value) => value !== undefined,
  )
    ? usage
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}
