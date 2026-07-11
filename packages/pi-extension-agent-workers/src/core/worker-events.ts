import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize, truncateHead } from "@earendil-works/pi-coding-agent";

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

export function boundFinalText(text: string, fullOutputPath: string): { text: string; truncated: boolean } {
  const truncation = truncateHead(text, { maxBytes: DEFAULT_MAX_BYTES, maxLines: DEFAULT_MAX_LINES });
  if (!truncation.truncated) return { text: truncation.content, truncated: false };
	return {
		text: `${truncation.content}\n\n[Output truncated at ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}. Full output: ${fullOutputPath}]`,
		truncated: true,
	};
}

export function toNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
