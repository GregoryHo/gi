import type { JiraConfig } from "./config.ts";
import { jiraAgileFetch } from "./jira-client.ts";
import type { JiraPagedValues, JiraSprint } from "./jira-types.ts";

export interface ActiveSprintResult {
  activeSprint?: JiraSprint;
  warning?: string;
}

export function buildActiveSprintPath(boardId: number): string {
  return `/board/${boardId}/sprint?state=active`;
}

export async function fetchActiveSprintForBoard(
  config: JiraConfig,
  boardId: number,
  signal?: AbortSignal,
): Promise<ActiveSprintResult> {
  try {
    const result = await jiraAgileFetch<JiraPagedValues<JiraSprint>>(config, buildActiveSprintPath(boardId), { signal });
    const activeSprint = result.values[0];
    if (!activeSprint) return { warning: `No active sprint for board ${boardId}; using project scope` };
    return { activeSprint };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { warning: `Active sprint lookup failed: ${message}` };
  }
}
