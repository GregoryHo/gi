import type { JiraConfig } from "./config.ts";
import { jiraAgileFetch, jiraApiFetch } from "./jira-client.ts";

export interface KanbanBoardFilterScope {
  filterId: string;
  name?: string;
  jql: string;
}

export interface KanbanBoardFilterScopeResult {
  scope?: KanbanBoardFilterScope;
  warning?: string;
}

interface BoardConfigurationResult {
  filter?: {
    id?: string | number;
    name?: string;
  };
}

interface SavedFilterResult {
  id?: string | number;
  name?: string;
  jql?: string;
}

export function buildBoardConfigurationPath(boardId: number): string {
  return `/board/${boardId}/configuration`;
}

export function buildFilterPath(filterId: string): string {
  return `/filter/${encodeURIComponent(filterId)}`;
}

export function splitJqlOrderBy(jql: string): { where: string; orderBy?: string } {
  const trimmed = jql.trim();
  const match = /\s+order\s+by\s+/i.exec(trimmed);
  if (!match?.index) return { where: trimmed };

  return {
    where: trimmed.slice(0, match.index).trim(),
    orderBy: trimmed.slice(match.index + match[0].length).trim(),
  };
}

export function composeScopedJql(input: {
  baseJql: string;
  clauses: string[];
  fallbackOrderBy: string;
}): string {
  const split = splitJqlOrderBy(input.baseJql);
  const clauses = [`(${split.where})`, ...input.clauses.filter((clause) => clause.trim())];
  return `${clauses.join(" AND ")} ORDER BY ${split.orderBy || input.fallbackOrderBy}`;
}

export async function fetchKanbanBoardFilterScope(
  config: JiraConfig,
  boardId: number,
  signal?: AbortSignal,
): Promise<KanbanBoardFilterScopeResult> {
  try {
    const configuration = await jiraAgileFetch<BoardConfigurationResult>(config, buildBoardConfigurationPath(boardId), {
      signal,
    });
    const filterId = configuration.filter?.id === undefined ? undefined : String(configuration.filter.id);
    if (!filterId) return { warning: `Board filter lookup failed: board ${boardId} has no saved filter id` };

    const filter = await jiraApiFetch<SavedFilterResult>(config, buildFilterPath(filterId), { signal });
    if (!filter.jql?.trim()) return { warning: `Board filter lookup failed: filter ${filterId} has no JQL` };

    return {
      scope: {
        filterId,
        name: filter.name ?? configuration.filter?.name,
        jql: filter.jql.trim(),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { warning: `Board filter lookup failed: ${message}` };
  }
}
