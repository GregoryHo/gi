import type { CompactJiraIssue } from "./issue-mapper.ts";
import { quoteJqlValue, type IssueStatusMode } from "./filter.ts";
import { composeScopedJql } from "../adapters/kanban.ts";

export type IssueFacetType =
  | "fixVersion"
  | "component"
  | "label"
  | "assignee"
  | "status"
  | "priority"
  | "issueType"
  | "text";

export interface IssueFacetFilter {
  type: IssueFacetType;
  value: string;
}

export type IssueScope =
  | { type: "project"; summary?: string }
  | { type: "sprint"; sprintId: number; summary?: string }
  | { type: "jql"; jql: string; summary?: string };

export interface IssueFilterState {
  project: string;
  scope?: IssueScope;
  statusMode?: IssueStatusMode;
  filters?: IssueFacetFilter[];
}

export interface IssueFacetValues {
  labels: string[];
  assignees: string[];
  statuses: string[];
  priorities: string[];
  issueTypes: string[];
}

export function collectIssueFacetValues(issues: CompactJiraIssue[]): IssueFacetValues {
  return {
    labels: uniqueSorted(issues.flatMap((issue) => issue.labels)),
    assignees: uniqueSorted(issues.map((issue) => issue.assignee).filter(isString)),
    statuses: uniqueSorted(issues.map((issue) => issue.status).filter(isString)),
    priorities: uniqueSorted(issues.map((issue) => issue.priority).filter(isString)),
    issueTypes: uniqueSorted(issues.map((issue) => issue.issueType).filter(isString)),
  };
}

export function addIssueFilter(state: IssueFilterState, filter: IssueFacetFilter): IssueFilterState {
  return { ...state, filters: [...(state.filters ?? []), filter] };
}

export function removeIssueFilters(state: IssueFilterState): IssueFilterState {
  return { ...state, filters: [] };
}

export function buildFacetedIssueJql(state: IssueFilterState): string {
  const clauses = filterClauses(state);
  if (state.scope?.type === "jql") {
    return composeScopedJql({ baseJql: state.scope.jql, clauses, fallbackOrderBy: "updated DESC" });
  }

  return `${[scopeClause(state), ...clauses].join(" AND ")} ORDER BY updated DESC`;
}

export function filterSummary(state: IssueFilterState): string {
  const parts = [state.scope?.summary ?? state.project];
  const statusMode = state.statusMode ?? "notDone";
  if (statusMode === "notDone") parts.push("not done");
  if (statusMode === "done") parts.push("done");
  if (statusMode === "all") parts.push("all");

  for (const filter of state.filters ?? []) {
    parts.push(`${filter.type}:${filter.value}`);
  }

  return parts.join(" · ");
}

function filterClauses(state: IssueFilterState): string[] {
  const clauses: string[] = [];

  for (const filter of state.filters ?? []) {
    clauses.push(`${fieldForFilter(filter.type)} ${operatorForFilter(filter.type)} ${quoteJqlValue(filter.value)}`);
  }

  const statusMode = state.statusMode ?? "notDone";
  if (statusMode === "notDone") clauses.push("statusCategory != Done");
  if (statusMode === "done") clauses.push("statusCategory = Done");
  return clauses;
}

function scopeClause(state: IssueFilterState): string {
  if (state.scope?.type === "sprint" && state.scope.sprintId !== undefined) {
    return `sprint = ${state.scope.sprintId}`;
  }
  return `project = ${quoteJqlValue(state.project)}`;
}

function fieldForFilter(type: IssueFacetType): string {
  switch (type) {
    case "fixVersion":
      return "fixVersion";
    case "component":
      return "component";
    case "label":
      return "labels";
    case "issueType":
      return "issuetype";
    default:
      return type;
  }
}

function operatorForFilter(type: IssueFacetType): string {
  return type === "text" ? "~" : "=";
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function isString(value: string | undefined): value is string {
  return Boolean(value);
}
