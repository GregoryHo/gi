import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, truncateToWidth, type Component } from "@earendil-works/pi-tui";

import { cockpitStateFromContext, renderJiraCockpitWidget } from "./jira-cockpit.ts";
import {
  JIRA_CONTEXT_ENTRY_TYPE,
  applyJiraRuntimeContext,
  captureJiraRuntimeContext,
  getActiveJiraBoard,
  getActiveJiraProjectKey,
  getJiraCurrentContext,
  setActiveJiraBoard,
  setActiveJiraProject,
  setFocusedJiraIssue,
  setJiraIssueFilterSummary,
} from "./jira-context.ts";
import { loadJiraConfig, type JiraConfig } from "./config.ts";
import {
  addIssueFilter,
  buildFacetedIssueJql,
  collectIssueFacetValues,
  filterSummary,
  removeIssueFilters,
  type IssueFacetFilter,
  type IssueFacetType,
  type IssueFilterState,
} from "./jira-facets.ts";
import { pageFacetValues, type FacetValueItem } from "./jira-facet-picker.ts";
import { parseJiraIssuesArgs } from "./jira-filter.ts";
import { mapJiraIssue, type CompactJiraIssue } from "./issue-mapper.ts";
import { jiraApiFetch } from "./jira-client.ts";
import {
  fetchProjectComponents,
  fetchProjectIssueTypes,
  fetchProjectVersions,
  sortProjectVersionsForPicker,
} from "./jira-metadata.ts";
import { queryJiraProjects, type JiraProjectPage } from "./jira-query.ts";
import { fetchKanbanBoardFilterScope, type KanbanBoardFilterScopeResult } from "./jira-kanban.ts";
import { fetchActiveSprintForBoard, type ActiveSprintResult } from "./jira-sprints.ts";
import { buildSearchPath, resolveSearchParams } from "./jira-tools.ts";
import { fetchAssignableUsers } from "./jira-users.ts";
import type { JiraIssue, JiraProject, JiraSearchResult } from "./jira-types.ts";

const BROWSE_PAGE_SIZE = 10;
const MAX_WIDGET_ISSUES = 3;

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

export function createPagedPickerComponent<T>(
  options: PagedPickerOptions<T>,
  done: (action: PickerAction<T>) => void,
): Component {
  let selectedIndex = 0;

  return {
    render(width: number): string[] {
      const lines: string[] = [];
      lines.push(truncateToWidth(options.title, width));
      lines.push(truncateToWidth(options.pageInfo, width));
      lines.push("");

      if (options.items.length === 0) {
        lines.push(truncateToWidth("No results", width));
      }

      for (let i = 0; i < options.items.length; i++) {
        const item = options.items[i];
        const prefix = i === selectedIndex ? "> " : "  ";
        lines.push(truncateToWidth(`${prefix}${item.label}`, width));
        if (item.description) {
          lines.push(truncateToWidth(`    ${item.description}`, width));
        }
      }

      lines.push("");
      const nav = [
        "↑↓ select",
        "Enter choose",
        options.canPrevious ? "p prev" : undefined,
        options.canNext ? "n next" : undefined,
        "f filter",
        "c clear",
        "Esc cancel",
      ].filter(Boolean);
      lines.push(truncateToWidth(nav.join(" • "), width));
      return lines;
    },
    handleInput(data: string): void {
      if (matchesKey(data, Key.up)) {
        selectedIndex = Math.max(0, selectedIndex - 1);
        return;
      }
      if (matchesKey(data, Key.down)) {
        selectedIndex = Math.min(options.items.length - 1, selectedIndex + 1);
        return;
      }
      if (matchesKey(data, Key.enter) && options.items[selectedIndex]) {
        done({ type: "select", item: options.items[selectedIndex] });
        return;
      }
      if (data === "n" && options.canNext) {
        done({ type: "next" });
        return;
      }
      if (data === "p" && options.canPrevious) {
        done({ type: "previous" });
        return;
      }
      if (data === "/" || data === "f") {
        done({ type: "filter" });
        return;
      }
      if (data === "c") {
        done({ type: "clear" });
        return;
      }
      if (matchesKey(data, Key.escape)) {
        done({ type: "cancel" });
      }
    },
    invalidate(): void {},
  };
}

export function formatProjectCardWidget(project: JiraProject, page?: JiraProjectPage): string[] {
  const lines = ["Selected Jira project", `${project.key}: ${project.name}`, `ID: ${project.id}`];
  if (page) {
    lines.push(`Project page: ${page.returned} of ${page.total} · startAt ${page.startAt}`);
  }
  return lines;
}

export function formatIssueCardsWidget(input: {
  title: string;
  jql: string;
  startAt: number;
  total: number;
  returned: number;
  issues: CompactJiraIssue[];
}): string[] {
  const lines = [
    `${input.title} · ${input.returned}/${input.total} · startAt ${input.startAt}`,
    `JQL: ${input.jql}`,
    "",
  ];

  for (const issue of input.issues.slice(0, MAX_WIDGET_ISSUES)) {
    lines.push(`${issue.key}  ${issue.status}${issue.priority ? `  ${issue.priority}` : ""}`);
    lines.push(issue.summary);
    const meta = [`assignee: ${issue.assignee ?? "unassigned"}`];
    meta.push(`labels: ${issue.labels.length > 0 ? issue.labels.join(", ") : "none"}`);
    lines.push(meta.join(" · "));
    lines.push("");
  }

  return lines.filter((line, index, all) => !(line === "" && index === all.length - 1));
}

export interface JiraBrowserDependencies {
  loadConfig?: () => JiraConfig;
  queryProjects?: typeof queryJiraProjects;
  custom?: (ctx: unknown, page: JiraProjectPage) => Promise<PickerAction<JiraProject>>;
  customIssue?: (ctx: unknown, page: IssueBrowserPage) => Promise<PickerAction<CompactJiraIssue>>;
  queryIssuePage?: typeof queryIssuePage;
  fetchActiveSprint?: (config: JiraConfig, boardId: number, signal?: AbortSignal) => Promise<ActiveSprintResult>;
  fetchKanbanFilterScope?: (config: JiraConfig, boardId: number, signal?: AbortSignal) => Promise<KanbanBoardFilterScopeResult>;
  fetchAssignableUsers?: typeof fetchAssignableUsers;
  fetchIssueTypes?: typeof fetchProjectIssueTypes;
}

export function registerJiraBrowserCommands(
  pi: ExtensionAPI,
  widgetName: string,
  dependencies: JiraBrowserDependencies = {},
): void {
  const loadConfig = dependencies.loadConfig ?? (() => applyJiraRuntimeContext(loadJiraConfig()));
  const queryProjects = dependencies.queryProjects ?? queryJiraProjects;
  const fetchActiveSprint = dependencies.fetchActiveSprint ?? fetchActiveSprintForBoard;
  const fetchKanbanFilterScope = dependencies.fetchKanbanFilterScope ?? fetchKanbanBoardFilterScope;
  const fetchIssuePage = dependencies.queryIssuePage ?? queryIssuePage;
  const searchAssignableUsers = dependencies.fetchAssignableUsers ?? fetchAssignableUsers;
  const loadIssueTypes = dependencies.fetchIssueTypes ?? fetchProjectIssueTypes;

  pi.registerCommand("jira-projects", {
    description: "Browse Jira projects with filtering and paging",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/jira-projects requires interactive UI", "error");
        return;
      }

      try {
        const config = loadConfig();
        let query = args?.trim() || undefined;
        let startAt = 0;

        while (true) {
          const page = await queryProjects(config, { query, startAt, maxResults: BROWSE_PAGE_SIZE }, ctx.signal);
          const action = dependencies.custom ? await dependencies.custom(ctx, page) : await showProjectPicker(ctx, page);

          if (action.type === "cancel") return;
          if (action.type === "next") {
            startAt += BROWSE_PAGE_SIZE;
            continue;
          }
          if (action.type === "previous") {
            startAt = Math.max(0, startAt - BROWSE_PAGE_SIZE);
            continue;
          }
          if (action.type === "filter") {
            query = (await ctx.ui.input("Filter Jira projects", query ?? ""))?.trim() || undefined;
            startAt = 0;
            continue;
          }
          if (action.type === "clear") {
            query = undefined;
            startAt = 0;
            continue;
          }
          if (action.type === "status") {
            continue;
          }

          const selectedProject = action.item.value;
          setActiveJiraProject(selectedProject);
          pi.appendEntry(JIRA_CONTEXT_ENTRY_TYPE, captureJiraRuntimeContext());
          ctx.ui.setWidget(widgetName, renderJiraCockpitWidget(cockpitStateFromContext(getJiraCurrentContext(config)), "compact"));
          ctx.ui.notify(`Selected Jira project ${selectedProject.key}`, "info");
          return;
        }
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });

  pi.registerCommand("jira-issues", {
    description: "Browse Jira issues with paging and focus one issue in the widget",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/jira-issues requires interactive UI", "error");
        return;
      }

      try {
        const config = loadConfig();
        const parsedArgs = parseJiraIssuesArgs(args);
        let rawJql = parsedArgs.mode === "jql" ? parsedArgs.jql : undefined;
        const project = parsedArgs.mode === "project" ? parsedArgs.project : getActiveJiraProjectKey() ?? config.project;
        let filterState = await resolveInitialIssueFilterState({
          config,
          project,
          useBoardScope: parsedArgs.mode === "guided",
          signal: ctx.signal,
          fetchActiveSprint,
          fetchKanbanFilterScope,
          notify: (message) => ctx.ui.notify(message, "warning"),
        });
        if (filterState) {
          setJiraIssueFilterSummary(filterSummary(filterState));
          pi.appendEntry(JIRA_CONTEXT_ENTRY_TYPE, captureJiraRuntimeContext());
        }
        let startAt = 0;

        while (true) {
          const page = await fetchIssuePage(config, rawJql ?? (filterState ? buildFacetedIssueJql(filterState) : undefined), startAt, ctx.signal);
          if (filterState) {
            ctx.ui.setWidget(
              widgetName,
              renderJiraCockpitWidget(
                cockpitStateFromContext(getJiraCurrentContext(config), {
                  filter: {
                    summary: filterSummary(filterState),
                    returned: page.returned,
                    total: page.total,
                    startAt: page.startAt,
                  },
                }),
                "compact",
              ),
            );
          }
          const action = dependencies.customIssue ? await dependencies.customIssue(ctx, page) : await showIssuePicker(ctx, page);

          if (action.type === "cancel") return;
          if (action.type === "next") {
            startAt += BROWSE_PAGE_SIZE;
            continue;
          }
          if (action.type === "previous") {
            startAt = Math.max(0, startAt - BROWSE_PAGE_SIZE);
            continue;
          }
          if (action.type === "clear") {
            if (filterState) {
              filterState = removeIssueFilters(filterState);
              setJiraIssueFilterSummary(filterSummary(filterState));
              pi.appendEntry(JIRA_CONTEXT_ENTRY_TYPE, captureJiraRuntimeContext());
            }
            rawJql = undefined;
            startAt = 0;
            continue;
          }
          if (action.type === "status") {
            if (filterState) {
              const statusMode = await chooseIssueStatusMode(ctx);
              if (statusMode) {
                filterState = { ...filterState, statusMode };
                setJiraIssueFilterSummary(filterSummary(filterState));
                pi.appendEntry(JIRA_CONTEXT_ENTRY_TYPE, captureJiraRuntimeContext());
                rawJql = undefined;
                startAt = 0;
              }
            }
            continue;
          }
          if (action.type === "filter") {
            const next = await promptFacetedIssueFilter(ctx, config, filterState, page, searchAssignableUsers, loadIssueTypes);
            if (next.mode === "rawJql") {
              rawJql = next.jql;
              filterState = undefined;
            } else if (next.state) {
              filterState = next.state;
              setJiraIssueFilterSummary(filterSummary(filterState));
              pi.appendEntry(JIRA_CONTEXT_ENTRY_TYPE, captureJiraRuntimeContext());
              rawJql = undefined;
            }
            startAt = 0;
            continue;
          }

          setFocusedJiraIssue(action.item.value);
          pi.appendEntry(JIRA_CONTEXT_ENTRY_TYPE, captureJiraRuntimeContext());
          ctx.ui.setWidget(
            widgetName,
            renderJiraCockpitWidget(
              cockpitStateFromContext(getJiraCurrentContext(config), {
                filter: filterState
                  ? { summary: filterSummary(filterState), returned: page.returned, total: page.total, startAt: page.startAt }
                  : { summary: page.jql, returned: page.returned, total: page.total, startAt: page.startAt },
              }),
              "focus",
            ),
          );
          ctx.ui.notify(`Focused ${action.item.value.key}`, "info");
          return;
        }
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });
}

interface ResolveInitialIssueFilterStateOptions {
  config: JiraConfig;
  project: string | undefined;
  useBoardScope: boolean;
  signal?: AbortSignal;
  fetchActiveSprint: (config: JiraConfig, boardId: number, signal?: AbortSignal) => Promise<ActiveSprintResult>;
  fetchKanbanFilterScope: (config: JiraConfig, boardId: number, signal?: AbortSignal) => Promise<KanbanBoardFilterScopeResult>;
  notify: (message: string) => void;
}

async function resolveInitialIssueFilterState(
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

type FacetPromptResult = { mode: "state"; state?: IssueFilterState } | { mode: "rawJql"; jql: string };

async function chooseIssueStatusMode(ctx: {
  ui: { select(title: string, options: string[]): Promise<string | undefined> };
}): Promise<"notDone" | "all" | "done" | undefined> {
  const choice = await ctx.ui.select("Status category", ["not done", "all", "done"]);
  if (!choice) return undefined;
  return choice === "all" ? "all" : choice === "done" ? "done" : "notDone";
}

async function promptFacetedIssueFilter(
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

async function queryIssuePage(
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

async function showProjectPicker(
  ctx: {
    ui: {
      custom<T>(factory: (tui: { requestRender(): void }, theme: unknown, keybindings: unknown, done: (result: T) => void) => Component): Promise<T>;
    };
  },
  page: JiraProjectPage,
): Promise<PickerAction<JiraProject>> {
  return ctx.ui.custom<PickerAction<JiraProject>>((tui, _theme, _keybindings, done) => {
    const component = createPagedPickerComponent<JiraProject>(
      {
        title: "Jira projects",
        pageInfo: `Projects: ${page.returned} of ${page.total} · startAt ${page.startAt}`,
        items: page.projects.map((project) => ({
          value: project,
          label: project.key,
          description: project.name,
        })),
        canNext: !page.isLast,
        canPrevious: page.startAt > 0,
      },
      done,
    );
    return withRenderRequest(component, tui);
  });
}

export function createIssuePickerComponent(
  page: IssueBrowserPage,
  done: (action: PickerAction<CompactJiraIssue>) => void,
): Component {
  const component = createPagedPickerComponent<CompactJiraIssue>(
    {
      title: "Jira issues",
      pageInfo: `Issues: ${page.returned} of ${page.total} · startAt ${page.startAt}`,
      items: page.issues.map((issue) => ({
        value: issue,
        label: `${issue.key}: ${issue.summary}`,
        description: [issue.status, issue.priority, issue.assignee].filter(Boolean).join(" • "),
      })),
      canNext: !page.isLast,
      canPrevious: page.startAt > 0,
    },
    done,
  );

  return {
    ...component,
    render(width: number): string[] {
      const lines = component.render(width);
      const last = lines[lines.length - 1];
      if (last?.includes("Esc cancel") && !last.includes("s status")) {
        lines[lines.length - 1] = last.replace("Esc cancel", "s status • Esc cancel");
      }
      return lines;
    },
    handleInput(data: string): void {
      if (data === "s") {
        done({ type: "status" });
        return;
      }
      component.handleInput?.(data);
    },
  };
}

async function showIssuePicker(
  ctx: {
    ui: {
      custom<T>(factory: (tui: { requestRender(): void }, theme: unknown, keybindings: unknown, done: (result: T) => void) => Component): Promise<T>;
    };
  },
  page: IssueBrowserPage,
): Promise<PickerAction<CompactJiraIssue>> {
  return ctx.ui.custom<PickerAction<CompactJiraIssue>>((tui, _theme, _keybindings, done) => {
    const component = createIssuePickerComponent(page, done);
    return withRenderRequest(component, tui);
  });
}

function withRenderRequest(component: Component, tui: { requestRender(): void }): Component {
  return {
    ...component,
    handleInput(data: string): void {
      component.handleInput?.(data);
      tui.requestRender();
    },
  };
}
