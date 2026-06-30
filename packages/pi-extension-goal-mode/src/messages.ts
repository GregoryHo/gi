export const GOAL_MODE_INTERNAL_MESSAGE_MARKER = "[GOAL_MODE_INTERNAL]";

export interface GoalModeInternalMessageMetadata {
  goalId: string;
  runId: string;
  iterationId: number;
}

export interface GoalModeInternalMessage {
  metadata: GoalModeInternalMessageMetadata;
  text: string;
}

const METADATA_PREFIX = "metadata:";

export function markGoalModeInternalMessage(text: string, metadata?: GoalModeInternalMessageMetadata): string {
  if (!metadata) return `${GOAL_MODE_INTERNAL_MESSAGE_MARKER}\n${text}`;
  return [
    GOAL_MODE_INTERNAL_MESSAGE_MARKER,
    `${METADATA_PREFIX}${JSON.stringify(metadata)}`,
    text,
  ].join("\n");
}

export function isGoalModeInternalMessage(text: string): boolean {
  return text.includes(GOAL_MODE_INTERNAL_MESSAGE_MARKER);
}

export function extractGoalModeInternalMessage(text: string): GoalModeInternalMessage | undefined {
  if (!isGoalModeInternalMessage(text)) return undefined;
  const lines = text.split(/\r?\n/);
  const markerIndex = lines.findIndex((line) => line.trim() === GOAL_MODE_INTERNAL_MESSAGE_MARKER);
  if (markerIndex < 0) return undefined;
  const metadataLine = lines[markerIndex + 1] ?? "";
  if (!metadataLine.startsWith(METADATA_PREFIX)) return undefined;
  const metadata = parseMetadata(metadataLine.slice(METADATA_PREFIX.length));
  if (!metadata) return undefined;
  return {
    metadata,
    text: lines.slice(markerIndex + 2).join("\n").trimStart(),
  };
}

export function stripGoalModeInternalMessageMarker(text: string): string {
  return extractGoalModeInternalMessage(text)?.text ?? text.replace(GOAL_MODE_INTERNAL_MESSAGE_MARKER, "").trimStart();
}

function parseMetadata(json: string): GoalModeInternalMessageMetadata | undefined {
  try {
    const value = JSON.parse(json) as Partial<GoalModeInternalMessageMetadata>;
    if (typeof value.goalId !== "string" || typeof value.runId !== "string" || typeof value.iterationId !== "number") return undefined;
    return {
      goalId: value.goalId,
      runId: value.runId,
      iterationId: value.iterationId,
    };
  } catch {
    return undefined;
  }
}
