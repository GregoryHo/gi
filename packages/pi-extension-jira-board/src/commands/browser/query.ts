import { parseJiraIssuesArgs } from "../../core/filter.ts";
import { mapJiraIssue } from "../../core/issue-mapper.ts";
import { jiraApiFetch } from "../../adapters/client.ts";
import { buildSearchPath, resolveSearchParams } from "../../tools/index.ts";
import type { JiraConfig } from "../../config/index.ts";
import type { JiraIssue, JiraSearchResult } from "../../types.ts";
import { BROWSE_PAGE_SIZE, type IssueBrowserPage } from "./types.ts";

export function defaultProjectIssueJql(projectKey: string): string {
  return `project = ${projectKey} AND statusCategory != Done ORDER BY updated DESC`;
}

export function resolveIssueBrowserJql(
  args: string | undefined,
  activeProject: string | undefined,
  configuredProject: string | undefined,
): string | undefined {
  const parsed = parseJiraIssuesArgs(args);
  if (parsed.mode === "jql") return parsed.jql;
  if (parsed.mode === "project") return defaultProjectIssueJql(parsed.project);
  if (activeProject) return defaultProjectIssueJql(activeProject);
  if (configuredProject) return defaultProjectIssueJql(configuredProject);
  return undefined;
}


export async function queryIssuePage(
  config: JiraConfig,
  jql: string | undefined,
  startAt: number,
  signal?: AbortSignal,
): Promise<IssueBrowserPage> {
  const resolved = resolveSearchParams(config, {
    jql,
    startAt,
    maxResults: BROWSE_PAGE_SIZE,
    includeDescriptions: false,
  });
  const result = await jiraApiFetch<JiraSearchResult>(config, buildSearchPath(resolved), { signal });
  const issues = result.issues.map((issue: JiraIssue) =>
    mapJiraIssue(issue, config.baseUrl, { includeDescription: false }),
  );

  return {
    jql: resolved.jql,
    startAt: resolved.startAt,
    maxResults: resolved.maxResults,
    total: result.total,
    returned: issues.length,
    isLast: resolved.startAt + issues.length >= result.total,
    issues,
  };
}

