import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { cockpitStateFromContext, renderJiraCockpitWidget } from "../ui/cockpit.ts";
import {
  JIRA_CONTEXT_ENTRY_TYPE,
  applyJiraRuntimeContext,
  captureJiraRuntimeContext,
  getActiveJiraProjectKey,
  getJiraCurrentContext,
  setActiveJiraBoard,
} from "../state/context.ts";
import { loadJiraConfig, type JiraConfig } from "../config/index.ts";
import { jiraAgileFetch } from "../adapters/client.ts";
import { createPagedPickerComponent, type PickerAction } from "./browser.ts";
import { normalizeMaxResults, normalizeStartAt } from "../adapters/query.ts";
import type { JiraPagedValues } from "../types.ts";
import type { Component } from "@earendil-works/pi-tui";

const DEFAULT_BOARD_RESULTS = 10;
const MAX_BOARD_RESULTS = 50;

export interface JiraBoard {
  id: number;
  name: string;
  type?: string;
  projectKey?: string;
}

export interface JiraSearchBoardsParams {
  query?: string;
  startAt?: number;
  maxResults?: number;
}

export interface JiraBoardPage {
  startAt: number;
  maxResults: number;
  total: number;
  returned: number;
  isLast: boolean;
  boards: JiraBoard[];
}

export interface JiraBoardCommandsDependencies {
  loadConfig?: () => JiraConfig;
  queryBoards?: typeof queryJiraBoards;
  custom?: (ctx: unknown, page: JiraBoardPage) => Promise<PickerAction<JiraBoard>>;
}

export function buildBoardListPath(params: { projectKey: string; startAt?: number; maxResults?: number }): string {
  const query = new URLSearchParams({
    projectKeyOrId: params.projectKey,
    startAt: String(normalizeStartAt(params.startAt)),
    maxResults: String(normalizeMaxResults(params.maxResults, DEFAULT_BOARD_RESULTS, MAX_BOARD_RESULTS)),
  });
  return `/board?${query.toString()}`;
}

export function pageBoards(boards: JiraBoard[], params: JiraSearchBoardsParams = {}): JiraBoardPage {
  const query = params.query?.trim().toLowerCase();
  const filtered = query
    ? boards.filter((board) => `${board.name} ${board.type ?? ""}`.toLowerCase().includes(query))
    : boards;
  const startAt = normalizeStartAt(params.startAt);
  const maxResults = normalizeMaxResults(params.maxResults, DEFAULT_BOARD_RESULTS, MAX_BOARD_RESULTS);
  const page = filtered.slice(startAt, startAt + maxResults);

  return {
    startAt,
    maxResults,
    total: filtered.length,
    returned: page.length,
    isLast: startAt + page.length >= filtered.length,
    boards: page,
  };
}

export function formatBoardList(page: JiraBoardPage): string {
  const lines = [
    `Jira boards returned ${page.returned} of ${page.total} board(s). startAt=${page.startAt} maxResults=${page.maxResults} isLast=${page.isLast}`,
  ];
  for (const board of page.boards) {
    lines.push(`- ${board.id}: ${board.name}${board.type ? ` (${board.type})` : ""}`);
  }
  return lines.join("\n");
}

export async function queryJiraBoards(
  config: JiraConfig,
  params: JiraSearchBoardsParams = {},
  signal?: AbortSignal,
): Promise<JiraBoardPage> {
  const projectKey = config.project;
  if (!projectKey) {
    throw new Error("jira board browsing requires an active or configured Jira project");
  }

  const result = await jiraAgileFetch<JiraPagedValues<JiraBoard>>(
    config,
    buildBoardListPath({ projectKey, startAt: 0, maxResults: MAX_BOARD_RESULTS }),
    { signal },
  );
  return pageBoards(result.values.map(normalizeBoard), params);
}

export function registerJiraBoardCommands(
  pi: ExtensionAPI,
  widgetName: string,
  dependencies: JiraBoardCommandsDependencies = {},
): void {
  const loadConfig = dependencies.loadConfig ?? (() => applyJiraRuntimeContext(loadJiraConfig()));
  const queryBoards = dependencies.queryBoards ?? queryJiraBoards;

  pi.registerCommand("jira-boards", {
    description: "Browse Jira boards for the active project and apply an active board context",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/jira-boards requires interactive UI", "error");
        return;
      }

      try {
        const config = loadConfig();
        let query = args?.trim() || undefined;
        let startAt = 0;

        while (true) {
          const page = await queryBoards(config, { query, startAt, maxResults: DEFAULT_BOARD_RESULTS }, ctx.signal);
          const action = dependencies.custom ? await dependencies.custom(ctx, page) : await showBoardPicker(ctx, config.project, page);

          if (action.type === "cancel") return;
          if (action.type === "next") {
            startAt += DEFAULT_BOARD_RESULTS;
            continue;
          }
          if (action.type === "previous") {
            startAt = Math.max(0, startAt - DEFAULT_BOARD_RESULTS);
            continue;
          }
          if (action.type === "filter") {
            query = (await ctx.ui.input("Filter Jira boards", query ?? ""))?.trim() || undefined;
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

          const board = { ...action.item.value, projectKey: action.item.value.projectKey ?? config.project ?? getActiveJiraProjectKey() };
          setActiveJiraBoard(board);
          pi.appendEntry(JIRA_CONTEXT_ENTRY_TYPE, captureJiraRuntimeContext());
          ctx.ui.setWidget(widgetName, renderJiraCockpitWidget(cockpitStateFromContext(getJiraCurrentContext(config)), "compact"));
          ctx.ui.notify(`Selected Jira board ${board.name}`, "info");
          return;
        }
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });
}

async function showBoardPicker(
  ctx: {
    ui: {
      custom<T>(factory: (tui: { requestRender(): void }, theme: unknown, keybindings: unknown, done: (result: T) => void) => Component): Promise<T>;
    };
  },
  projectKey: string | undefined,
  page: JiraBoardPage,
): Promise<PickerAction<JiraBoard>> {
  return ctx.ui.custom<PickerAction<JiraBoard>>((tui, _theme, _keybindings, done) => {
    const component = createPagedPickerComponent<JiraBoard>(
      {
        title: `Jira boards${projectKey ? ` · ${projectKey}` : ""}`,
        pageInfo: `Boards: ${page.returned} of ${page.total} · startAt ${page.startAt}`,
        items: page.boards.map((board) => ({
          value: board,
          label: board.name,
          description: [String(board.id), board.type].filter(Boolean).join(" • "),
        })),
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
}

function normalizeBoard(board: JiraBoard): JiraBoard {
  return {
    id: Number(board.id),
    name: board.name,
    ...(board.type ? { type: board.type } : {}),
    ...(board.projectKey ? { projectKey: board.projectKey } : {}),
  };
}
