import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import {
  applyJiraRuntimeContext,
  formatJiraCurrentContext,
  getFocusedJiraIssueKeyOrThrow,
  getJiraCurrentContext,
} from "./jira-context.ts";
import type { JiraConfig } from "./config.ts";
import { loadJiraConfig } from "./config.ts";
import { formatBoardSnapshot, getBoardSnapshot } from "./board-snapshot.ts";
import { formatIssueList, formatIssueSummary, mapJiraIssue } from "./issue-mapper.ts";
import { jiraApiFetch } from "./jira-client.ts";
import { formatProjectList, normalizeMaxResults, normalizeStartAt, queryJiraProjects, type JiraSearchProjectsParams } from "./jira-query.ts";
import type { JiraIssue, JiraSearchResult } from "./jira-types.ts";

const ISSUE_FIELDS = "summary,description,status,labels,assignee,priority,issuetype";
const DEFAULT_SEARCH_RESULTS = 10;
export const MAX_SEARCH_RESULTS = 25;

export interface JiraGetIssueParams {
  issueKey: string;
  includeDescription?: boolean;
}

export interface JiraSearchIssuesParams {
  jql?: string;
  startAt?: number;
  maxResults?: number;
  includeDescriptions?: boolean;
}

export interface JiraBoardSnapshotParams {
  jql?: string;
  maxResults?: number;
  refresh?: boolean;
}

export interface ResolvedSearchParams {
  jql: string;
  startAt: number;
  maxResults: number;
  includeDescriptions: boolean;
}

export function buildIssuePath(issueKey: string): string {
  const params = new URLSearchParams({ fields: ISSUE_FIELDS });
  return `/issue/${encodeURIComponent(issueKey.trim())}?${params.toString()}`;
}

export function resolveSearchParams(config: JiraConfig, params: JiraSearchIssuesParams): ResolvedSearchParams {
  const jql = params.jql?.trim();
  const resolvedJql =
    jql ||
    (config.project ? `project = ${config.project} AND statusCategory != Done ORDER BY updated DESC` : undefined);

  if (!resolvedJql) {
    throw new Error("jira_search_issues requires either jql or JIRA_PROJECT configuration");
  }

  const startAt = normalizeStartAt(params.startAt);
  const maxResults = normalizeMaxResults(params.maxResults, DEFAULT_SEARCH_RESULTS, MAX_SEARCH_RESULTS);

  return {
    jql: resolvedJql,
    startAt,
    maxResults,
    includeDescriptions: params.includeDescriptions ?? false,
  };
}

export function buildSearchPath(params: { jql: string; startAt?: number; maxResults: number }): string {
  const query = new URLSearchParams({
    jql: params.jql,
    startAt: String(params.startAt ?? 0),
    maxResults: String(params.maxResults),
    fields: ISSUE_FIELDS,
  });
  return `/search?${query.toString()}`;
}

export function registerJiraTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "jira_get_current_context",
    label: "Jira Get Current Context",
    description: "Return the current Jira project, board, issue filters, and focused issue from extension state. Read-only.",
    promptSnippet: "Get current Jira project/board/filter/focused issue context",
    promptGuidelines: [
      "Use jira_get_current_context when the user refers to the current Jira project, board, filter, or focused issue without naming it explicitly.",
    ],
    parameters: Type.Object({}),
    async execute() {
      const config = applyJiraRuntimeContext(loadJiraConfig());
      const context = getJiraCurrentContext(config);

      return {
        content: [{ type: "text", text: formatJiraCurrentContext(context) }],
        details: { context },
      };
    },
  });

  pi.registerTool({
    name: "jira_get_focused_issue",
    label: "Jira Get Focused Issue",
    description: "Fetch compact context for the currently focused Jira issue. Read-only.",
    promptSnippet: "Fetch the current focused Jira issue without requiring an issue key",
    promptGuidelines: [
      "Use jira_get_focused_issue when the user asks about the focused/current Jira issue without naming an issue key.",
    ],
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, signal) {
      const config = applyJiraRuntimeContext(loadJiraConfig());
      const issueKey = getFocusedJiraIssueKeyOrThrow();
      const issue = await jiraApiFetch<JiraIssue>(config, buildIssuePath(issueKey), { signal });
      const compact = mapJiraIssue(issue, config.baseUrl, { includeDescription: true });

      return {
        content: [{ type: "text", text: formatIssueSummary(compact) }],
        details: { issue: compact },
      };
    },
  });

  pi.registerTool({
    name: "jira_search_projects",
    label: "Jira Search Projects",
    description: "List accessible Jira projects with bounded filtering and paging. Read-only.",
    promptSnippet: "Search Jira projects with bounded filter and paging",
    promptGuidelines: [
      "Use jira_search_projects when the user needs to discover available Jira projects before searching issues.",
      "jira_search_projects returns at most 50 projects; ask for a narrower query when more precision is needed.",
    ],
    parameters: Type.Object({
      query: Type.Optional(Type.String({ description: "Optional case-insensitive filter for project key or name." })),
      startAt: Type.Optional(Type.Number({ description: "Zero-based page offset. Defaults to 0." })),
      maxResults: Type.Optional(Type.Number({ description: "Maximum projects to return. Defaults to 25 and caps at 50." })),
    }),
    async execute(_toolCallId, params: JiraSearchProjectsParams, signal) {
      const config = applyJiraRuntimeContext(loadJiraConfig());
      const page = await queryJiraProjects(config, params, signal);

      return {
        content: [{ type: "text", text: formatProjectList(page) }],
        details: page,
      };
    },
  });

  pi.registerTool({
    name: "jira_get_issue",
    label: "Jira Get Issue",
    description: "Fetch one Jira issue by key from a self-hosted Jira instance. Read-only.",
    promptSnippet: "Fetch compact read-only context for one Jira issue by key",
    promptGuidelines: [
      "Use jira_get_issue when the user asks about a specific Jira ticket or when planning work from a Jira issue key.",
    ],
    parameters: Type.Object({
      issueKey: Type.String({ description: "Jira issue key, for example PROJ-123" }),
      includeDescription: Type.Optional(Type.Boolean({ description: "Include the issue description; defaults to true" })),
    }),
    async execute(_toolCallId, params: JiraGetIssueParams, signal) {
      const config = applyJiraRuntimeContext(loadJiraConfig());
      const issue = await jiraApiFetch<JiraIssue>(config, buildIssuePath(params.issueKey), { signal });
      const compact = mapJiraIssue(issue, config.baseUrl, {
        includeDescription: params.includeDescription ?? true,
      });

      return {
        content: [{ type: "text", text: formatIssueSummary(compact) }],
        details: { issue: compact },
      };
    },
  });

  pi.registerTool({
    name: "jira_search_issues",
    label: "Jira Search Issues",
    description: "Run a bounded read-only Jira JQL search and return compact issue summaries.",
    promptSnippet: "Search Jira issues with bounded JQL results and compact summaries",
    promptGuidelines: [
      "Use jira_search_issues when the user asks for Jira project context or needs candidate tickets before planning.",
      "jira_search_issues returns at most 25 issues; ask for a narrower JQL query when more precision is needed.",
    ],
    parameters: Type.Object({
      jql: Type.Optional(
        Type.String({ description: "Jira JQL. If omitted, JIRA_PROJECT is used for a safe open-issue default." }),
      ),
      startAt: Type.Optional(Type.Number({ description: "Zero-based page offset. Defaults to 0." })),
      maxResults: Type.Optional(Type.Number({ description: "Maximum issues to return. Defaults to 10 and caps at 25." })),
      includeDescriptions: Type.Optional(Type.Boolean({ description: "Include truncated descriptions; defaults to false." })),
    }),
    async execute(_toolCallId, params: JiraSearchIssuesParams, signal) {
      const config = applyJiraRuntimeContext(loadJiraConfig());
      const resolved = resolveSearchParams(config, params);
      const result = await jiraApiFetch<JiraSearchResult>(config, buildSearchPath(resolved), { signal });
      const issues = result.issues.map((issue) =>
        mapJiraIssue(issue, config.baseUrl, { includeDescription: resolved.includeDescriptions }),
      );

      return {
        content: [{ type: "text", text: formatIssueList(issues, result.total, resolved.jql) }],
        details: {
          jql: resolved.jql,
          startAt: resolved.startAt,
          maxResults: resolved.maxResults,
          total: result.total,
          returned: issues.length,
          issues,
        },
      };
    },
  });

  pi.registerTool({
    name: "jira_board_snapshot",
    label: "Jira Board Snapshot",
    description: "Fetch a compact read-only Jira board/project snapshot for the configured project or board.",
    promptSnippet: "Summarize current Jira board or project context with bounded issue results",
    promptGuidelines: [
      "Use jira_board_snapshot when the user asks for current Jira board, sprint, or project context.",
      "jira_board_snapshot is bounded and read-only; use refresh true when the user explicitly asks for fresh Jira state.",
    ],
    parameters: Type.Object({
      jql: Type.Optional(Type.String({ description: "Optional JQL override. Defaults to active sprint or configured project." })),
      maxResults: Type.Optional(Type.Number({ description: "Maximum issues to sample. Defaults to 25 and caps at 50." })),
      refresh: Type.Optional(Type.Boolean({ description: "Bypass the brief in-memory cache; defaults to false." })),
    }),
    async execute(_toolCallId, params: JiraBoardSnapshotParams, signal) {
      const config = applyJiraRuntimeContext(loadJiraConfig());
      const snapshot = await getBoardSnapshot(config, params, signal);

      return {
        content: [{ type: "text", text: formatBoardSnapshot(snapshot) }],
        details: { snapshot },
      };
    },
  });
}
