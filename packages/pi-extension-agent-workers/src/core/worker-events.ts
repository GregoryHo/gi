export type UsageSource = "reported" | "estimated" | "unknown";

export interface WorkerUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningOutputTokens?: number;
  costUsd?: number;
  source: UsageSource;
}

export type WorkerEvent =
  | { type: "output"; stream: "stdout" | "stderr"; text: string; timestamp: number }
  | { type: "activity"; label: string; details?: Record<string, unknown>; timestamp: number }
  | { type: "usage"; usage: WorkerUsage; timestamp: number }
  | { type: "final"; text?: string; timestamp: number }
  | { type: "error"; message: string; timestamp: number };

export function unknownUsage(): WorkerUsage {
  return { source: "unknown" };
}

export function textPreview(text: string, maxLength = 160): string {
  const compact = text.trim().replace(/\s+/g, " ");
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 3)}...`;
}

export function toNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
