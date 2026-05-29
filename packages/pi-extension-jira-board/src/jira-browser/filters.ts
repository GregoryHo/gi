import type { Component } from "@earendil-works/pi-tui";

import { getActiveJiraBoard, setActiveJiraBoard } from "../jira-context.ts";
import { fetchProjectComponents, fetchProjectIssueTypes, fetchProjectVersions, sortProjectVersionsForPicker } from "../jira-metadata.ts";
import { fetchKanbanBoardFilterScope, type KanbanBoardFilterScopeResult } from "../jira-kanban.ts";
import { fetchActiveSprintForBoard, type ActiveSprintResult } from "../jira-sprints.ts";
import { addIssueFilter, buildFacetedIssueJql, collectIssueFacetValues, type IssueFacetFilter, type IssueFacetType, type IssueFilterState } from "../jira-facets.ts";
import { pageFacetValues, type FacetValueItem } from "../jira-facet-picker.ts";
import { fetchAssignableUsers } from "../jira-users.ts";
import type { JiraConfig } from "../config.ts";
import type { CompactJiraIssue } from "../issue-mapper.ts";
import { createPagedPickerComponent } from "./picker.ts";
import { BROWSE_PAGE_SIZE, type IssueBrowserPage, type PickerAction } from "./types.ts";

export interface ResolveInitialIssueFilterStateOptions {
  config: JiraConfig;
  project: string | undefined;
  useBoardScope: boolean;
  signal?: AbortSignal;
  fetchActiveSprint: (config: JiraConfig, boardId: number, signal?: AbortSignal) => Promise<ActiveSprintResult>;
  fetchKanbanFilterScope: (config: JiraConfig, boardId: number, signal?: AbortSignal) => Promise<KanbanBoardFilterScopeResult>;
  notify: (message: string) => void;
}

export async function resolveInitialIssueFilterState(
  options: ResolveInitialIssueFilterStateOptions,
): Promise<IssueFilterState | undefined> {
  if (!options.project) return undefined;

  const activeBoard = getActiveJiraBoard();
  if (options.useBoardScope && activeBoard?.type === "scrum") {
    const result = await options.fetchActiveSprint(options.config, activeBoard.id, options.signal);
    if (result.activeSprint) {
      return {
        project: options.project,
        scope: { type: "sprint", sprintId: result.activeSprint.id, summary: result.activeSprint.name },
        statusMode: "notDone",
        filters: [],
      };
    }
    if (result.warning) options.notify(result.warning);
  }

  if (options.useBoardScope && activeBoard?.type === "kanban") {
    const result = await options.fetchKanbanFilterScope(options.config, activeBoard.id, options.signal);
    if (result.scope) {
      setActiveJiraBoard({ ...activeBoard, filterScope: result.scope });
      return {
        project: options.project,
        scope: {
          type: "jql",
          jql: result.scope.jql,
          summary: `Board filter "${result.scope.name ?? result.scope.filterId}"`,
        },
        statusMode: "notDone",
        filters: [],
      };
    }
    if (result.warning) options.notify(result.warning);
  }

  return { project: options.project, statusMode: "notDone", filters: [] };
}

export type FacetPromptResult = { mode: "state"; state?: IssueFilterState } | { mode: "rawJql"; jql: string };

export async function chooseIssueStatusMode(ctx: {
  ui: { select(title: string, options: string[]): Promise<string | undefined> };
}): Promise<"notDone" | "all" | "done" | undefined> {
  const choice = await ctx.ui.select("Status category", ["not done", "all", "done"]);
  if (!choice) return undefined;
  return choice === "all" ? "all" : choice === "done" ? "done" : "notDone";
}

export async function promptFacetedIssueFilter(
  ctx: {
    signal?: AbortSignal;
    ui: {
      input(title: string, placeholder?: string): Promise<string | undefined>;
      select(title: string, options: string[]): Promise<string | undefined>;
      custom<T>(factory: (tui: { requestRender(): void }, theme: unknown, keybindings: unknown, done: (result: T) => void) => Component): Promise<T>;
    };
  },
  config: JiraConfig,
  state: IssueFilterState | undefined,
  page: IssueBrowserPage,
  searchAssignableUsers: typeof fetchAssignableUsers,
  loadIssueTypes: typeof fetchProjectIssueTypes,
): Promise<FacetPromptResult> {
  if (!state) {
    const jql = await ctx.ui.input("Advanced Jira JQL", page.jql);
    return jql?.trim() ? { mode: "rawJql", jql: jql.trim() } : { mode: "rawJql", jql: page.jql };
  }

  const facetType = await ctx.ui.select("Add Jira issue filter", [
    "Fix Version",
    "Component",
    "Label",
    "Assignee",
    "Status",
    "Priority",
    "Issue Type",
    "Text Search",
    "Status Category",
    "Advanced JQL",
  ]);
  if (!facetType) return { mode: "state", state };

  if (facetType === "Advanced JQL") {
    const jql = await ctx.ui.input("Advanced Jira JQL", buildFacetedIssueJql(state));
    return jql?.trim() ? { mode: "rawJql", jql: jql.trim() } : { mode: "state", state };
  }

  if (facetType === "Status Category") {
    const choice = await ctx.ui.select("Status category", ["not done", "all", "done"]);
    const statusMode = choice === "all" ? "all" : choice === "done" ? "done" : "notDone";
    return { mode: "state", state: { ...state, statusMode } };
  }

  if (facetType === "Text Search") {
    const text = await ctx.ui.input("Text search", "login");
    return text?.trim()
      ? { mode: "state", state: addIssueFilter(state, { type: "text", value: text.trim() }) }
      : { mode: "state", state };
  }

  const filter = await chooseFacetValue(ctx, config, state.project, facetType, page.issues, searchAssignableUsers, loadIssueTypes);
  return filter ? { mode: "state", state: addIssueFilter(state, filter) } : { mode: "state", state };
}

async function chooseFacetValue(
  ctx: {
    signal?: AbortSignal;
    ui: {
      input(title: string, placeholder?: string): Promise<string | undefined>;
      select(title: string, options: string[]): Promise<string | undefined>;
      custom<T>(factory: (tui: { requestRender(): void }, theme: unknown, keybindings: unknown, done: (result: T) => void) => Component): Promise<T>;
    };
  },
  config: JiraConfig,
  project: string,
  label: string,
  issues: CompactJiraIssue[],
  searchAssignableUsers: typeof fetchAssignableUsers,
  loadIssueTypes: typeof fetchProjectIssueTypes,
): Promise<IssueFacetFilter | undefined> {
  if (label === "Assignee") {
    const query = (await ctx.ui.input("Search assignable Jira users", "name, username, or email"))?.trim();
    if (!query) return undefined;
    const users = await searchAssignableUsers(config, project, query, ctx.signal);
    if (users.length === 0) throw new Error(`No assignable Jira users found for "${query}" in ${project}`);
    const value = await choosePagedFacetValue(ctx, label, users);
    return value ? { type: "assignee", value } : undefined;
  }

  const values = await facetValuesFor(ctx, config, project, label, issues, loadIssueTypes);
  if (values.length === 0) {
    await ctx.ui.select(`${label} values`, ["No values available"]);
    return undefined;
  }

  const value = await choosePagedFacetValue(
    ctx,
    label,
    values.map((value): FacetValueItem => ({ value, label: value })),
  );
  if (!value) return undefined;
  return { type: facetTypeForLabel(label), value };
}

async function choosePagedFacetValue(
  ctx: {
    ui: {
      input(title: string, placeholder?: string): Promise<string | undefined>;
      custom<T>(factory: (tui: { requestRender(): void }, theme: unknown, keybindings: unknown, done: (result: T) => void) => Component): Promise<T>;
    };
  },
  label: string,
  values: FacetValueItem[],
): Promise<string | undefined> {
  let query: string | undefined;
  let startAt = 0;
  const items = values;

  while (true) {
    const page = pageFacetValues(items, { query, startAt, maxResults: BROWSE_PAGE_SIZE });
    const action = await ctx.ui.custom<PickerAction<FacetValueItem>>((tui, _theme, _keybindings, done) => {
      const component = createPagedPickerComponent<FacetValueItem>(
        {
          title: label,
          pageInfo: `Values: ${page.returned} of ${page.total} · startAt ${page.startAt}`,
          items: page.values.map((item) => ({ value: item, label: item.label, description: item.description })),
          canNext: !page.isLast,
          canPrevious: page.startAt > 0,
        },
        done,
      );
      return {
        ...component,
        handleInput(data: string): void {
          component.handleInput?.(data);
          tui.requestRender();
        },
      };
    });

    if (action.type === "cancel") return undefined;
    if (action.type === "select") return action.item.value.value;
    if (action.type === "next") {
      startAt += BROWSE_PAGE_SIZE;
      continue;
    }
    if (action.type === "previous") {
      startAt = Math.max(0, startAt - BROWSE_PAGE_SIZE);
      continue;
    }
    if (action.type === "filter") {
      query = (await ctx.ui.input(`Filter ${label}`, query ?? ""))?.trim() || undefined;
      startAt = 0;
      continue;
    }
    if (action.type === "clear") {
      query = undefined;
      startAt = 0;
    }
  }
}

async function facetValuesFor(
  ctx: { signal?: AbortSignal },
  config: JiraConfig,
  project: string,
  label: string,
  issues: CompactJiraIssue[],
  loadIssueTypes: typeof fetchProjectIssueTypes,
): Promise<string[]> {
  if (label === "Fix Version") return sortProjectVersionsForPicker(await fetchProjectVersions(config, project, ctx.signal)).map((version) => version.name);
  if (label === "Component") return (await fetchProjectComponents(config, project, ctx.signal)).map((component) => component.name);
  if (label === "Issue Type") return (await loadIssueTypes(config, project, ctx.signal)).map((issueType) => issueType.name);

  const aggregated = collectIssueFacetValues(issues);
  if (label === "Label") return aggregated.labels;
  if (label === "Assignee") return aggregated.assignees;
  if (label === "Status") return aggregated.statuses;
  if (label === "Priority") return aggregated.priorities;
  return [];
}

function facetTypeForLabel(label: string): IssueFacetType {
  if (label === "Fix Version") return "fixVersion";
  if (label === "Component") return "component";
  if (label === "Label") return "label";
  if (label === "Assignee") return "assignee";
  if (label === "Status") return "status";
  if (label === "Priority") return "priority";
  if (label === "Issue Type") return "issueType";
  return "text";
}

