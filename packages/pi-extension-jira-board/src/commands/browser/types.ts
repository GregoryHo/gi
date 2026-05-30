import type { ActiveSprintResult } from "../../adapters/sprints.ts";
import type { CompactJiraIssue } from "../../core/issue-mapper.ts";
import type { JiraConfig } from "../../config/index.ts";
import type { JiraProject } from "../../types.ts";
import type { JiraProjectPage } from "../../adapters/query.ts";
import type { KanbanBoardFilterScopeResult } from "../../adapters/kanban.ts";
import type { fetchAssignableUsers } from "../../adapters/users.ts";
import type { fetchProjectIssueTypes } from "../../adapters/metadata.ts";

export const BROWSE_PAGE_SIZE = 10;
export const MAX_WIDGET_ISSUES = 3;

export interface PickerItem<T> {
  value: T;
  label: string;
  description?: string;
}

export type PickerAction<T> =
  | { type: "select"; item: PickerItem<T> }
  | { type: "next" }
  | { type: "previous" }
  | { type: "filter" }
  | { type: "status" }
  | { type: "clear" }
  | { type: "cancel" };

export interface PagedPickerOptions<T> {
  title: string;
  pageInfo: string;
  items: PickerItem<T>[];
  canNext: boolean;
  canPrevious: boolean;
}

export interface IssueBrowserPage {
  jql: string;
  startAt: number;
  maxResults: number;
  total: number;
  returned: number;
  isLast: boolean;
  issues: CompactJiraIssue[];
}

export interface JiraBrowserDependencies {
  loadConfig?: () => JiraConfig;
  queryProjects?: (config: JiraConfig, params: { query?: string; startAt?: number; maxResults?: number }, signal?: AbortSignal) => Promise<JiraProjectPage>;
  custom?: (ctx: unknown, page: JiraProjectPage) => Promise<PickerAction<JiraProject>>;
  customIssue?: (ctx: unknown, page: IssueBrowserPage) => Promise<PickerAction<CompactJiraIssue>>;
  queryIssuePage?: (config: JiraConfig, jql: string | undefined, startAt: number, signal?: AbortSignal) => Promise<IssueBrowserPage>;
  fetchActiveSprint?: (config: JiraConfig, boardId: number, signal?: AbortSignal) => Promise<ActiveSprintResult>;
  fetchKanbanFilterScope?: (config: JiraConfig, boardId: number, signal?: AbortSignal) => Promise<KanbanBoardFilterScopeResult>;
  fetchAssignableUsers?: typeof fetchAssignableUsers;
  fetchIssueTypes?: typeof fetchProjectIssueTypes;
}
