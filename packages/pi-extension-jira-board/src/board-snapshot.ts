import type { JiraConfig } from "./config.ts";
import { mapJiraIssue, type CompactJiraIssue } from "./issue-mapper.ts";
import { jiraApiFetch } from "./jira-client.ts";
import { buildActiveSprintPath, fetchActiveSprintForBoard } from "./jira-sprints.ts";
import type { JiraSearchResult, JiraSprint } from "./jira-types.ts";

const SNAPSHOT_FIELDS = "summary,description,status,labels,assignee,priority,issuetype";
const DEFAULT_SNAPSHOT_RESULTS = 25;
export const MAX_SNAPSHOT_RESULTS = 50;
const CACHE_TTL_MS = 60_000;

export interface BoardSnapshotParams {
  jql?: string;
  maxResults?: number;
  refresh?: boolean;
}

export interface BoardSnapshot {
  project?: string;
  boardId?: number;
  activeSprint?: JiraSprint;
  jql: string;
  total: number;
  returned: number;
  statusCounts: Record<string, number>;
  issues: CompactJiraIssue[];
  warnings: string[];
}

interface CacheEntry {
  expiresAt: number;
  snapshot: BoardSnapshot;
}

const cache = new Map<string, CacheEntry>();

export { buildActiveSprintPath };

export function resolveSnapshotMaxResults(maxResults: number | undefined): number {
  const requested = maxResults ?? DEFAULT_SNAPSHOT_RESULTS;
  return Math.max(1, Math.min(Math.floor(requested), MAX_SNAPSHOT_RESULTS));
}

function buildCacheKey(config: JiraConfig, params: BoardSnapshotParams): string {
  return JSON.stringify({
    baseUrl: config.baseUrl,
    project: config.project,
    boardId: config.boardId,
    jql: params.jql?.trim(),
    maxResults: resolveSnapshotMaxResults(params.maxResults),
  });
}

function buildSnapshotJql(config: JiraConfig, activeSprint: JiraSprint | undefined, explicitJql: string | undefined): string {
  if (explicitJql?.trim()) return explicitJql.trim();
  if (activeSprint) return `sprint = ${activeSprint.id} AND statusCategory != Done ORDER BY updated DESC`;
  if (config.project) return `project = ${config.project} AND statusCategory != Done ORDER BY updated DESC`;
  throw new Error("jira_board_snapshot requires either jql, JIRA_PROJECT, or an active sprint from JIRA_BOARD_ID");
}

function buildSnapshotSearchPath(jql: string, maxResults: number): string {
  const query = new URLSearchParams({
    jql,
    maxResults: String(maxResults),
    fields: SNAPSHOT_FIELDS,
  });
  return `/search?${query.toString()}`;
}

async function fetchActiveSprint(config: JiraConfig, signal?: AbortSignal): Promise<{
  activeSprint?: JiraSprint;
  warning?: string;
}> {
  if (config.boardId === undefined) return {};
  return fetchActiveSprintForBoard(config, config.boardId, signal);
}

function countStatuses(issues: CompactJiraIssue[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const issue of issues) {
    counts[issue.status] = (counts[issue.status] ?? 0) + 1;
  }
  return counts;
}

export async function getBoardSnapshot(
  config: JiraConfig,
  params: BoardSnapshotParams = {},
  signal?: AbortSignal,
): Promise<BoardSnapshot> {
  const cacheKey = buildCacheKey(config, params);
  const cached = cache.get(cacheKey);
  if (!params.refresh && cached && cached.expiresAt > Date.now()) {
    return cached.snapshot;
  }

  const warnings: string[] = [];
  const activeSprintResult = await fetchActiveSprint(config, signal);
  if (activeSprintResult.warning) warnings.push(activeSprintResult.warning);

  const maxResults = resolveSnapshotMaxResults(params.maxResults);
  const jql = buildSnapshotJql(config, activeSprintResult.activeSprint, params.jql);
  const result = await jiraApiFetch<JiraSearchResult>(config, buildSnapshotSearchPath(jql, maxResults), { signal });
  const issues = result.issues.map((issue) => mapJiraIssue(issue, config.baseUrl, { includeDescription: false }));

  const snapshot: BoardSnapshot = {
    project: config.project,
    boardId: config.boardId,
    activeSprint: activeSprintResult.activeSprint,
    jql,
    total: result.total,
    returned: issues.length,
    statusCounts: countStatuses(issues),
    issues,
    warnings,
  };

  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, snapshot });
  return snapshot;
}

export function formatBoardSnapshot(snapshot: BoardSnapshot): string {
  const lines = formatSnapshotWidget(snapshot);
  lines.push(`JQL: ${snapshot.jql}`);
  if (snapshot.warnings.length > 0) {
    lines.push("Warnings:", ...snapshot.warnings.map((warning) => `- ${warning}`));
  }
  return lines.join("\n");
}

export function formatSnapshotWidget(snapshot: BoardSnapshot): string[] {
  const titleParts = ["Jira"];
  if (snapshot.project) titleParts.push(snapshot.project);
  if (snapshot.boardId !== undefined) titleParts.push(`/ Board ${snapshot.boardId}`);

  const statusText = Object.entries(snapshot.statusCounts)
    .map(([status, count]) => `${status} ${count}`)
    .join(" | ");
  const recent = snapshot.issues
    .slice(0, 5)
    .map((issue) => issue.key)
    .join(", ");

  const lines = [
    titleParts.join(" "),
    `Sprint: ${snapshot.activeSprint?.name ?? "none"}`,
    `Issues: ${snapshot.returned} of ${snapshot.total}`,
    `Status: ${statusText || "none"}`,
    `Recent: ${recent || "none"}`,
  ];

  if (snapshot.warnings.length > 0) {
    lines.push(`Warnings: ${snapshot.warnings.length}`);
  }

  return lines;
}
