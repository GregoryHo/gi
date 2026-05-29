import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { cockpitStateFromContext, renderJiraCockpitWidget } from "../jira-cockpit.ts";
import {
  JIRA_CONTEXT_ENTRY_TYPE,
  applyJiraRuntimeContext,
  captureJiraRuntimeContext,
  getActiveJiraProjectKey,
  getJiraCurrentContext,
  setActiveJiraProject,
  setFocusedJiraIssue,
  setJiraIssueFilterSummary,
} from "../jira-context.ts";
import { loadJiraConfig } from "../config.ts";
import { buildFacetedIssueJql, filterSummary, removeIssueFilters } from "../jira-facets.ts";
import { parseJiraIssuesArgs } from "../jira-filter.ts";
import { fetchProjectIssueTypes } from "../jira-metadata.ts";
import { queryJiraProjects } from "../jira-query.ts";
import { fetchKanbanBoardFilterScope } from "../jira-kanban.ts";
import { fetchActiveSprintForBoard } from "../jira-sprints.ts";
import { fetchAssignableUsers } from "../jira-users.ts";
import { chooseIssueStatusMode, promptFacetedIssueFilter, resolveInitialIssueFilterState } from "./filters.ts";
import { showIssuePicker, showProjectPicker } from "./picker.ts";
import { queryIssuePage } from "./query.ts";
import { BROWSE_PAGE_SIZE, type JiraBrowserDependencies } from "./types.ts";

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

