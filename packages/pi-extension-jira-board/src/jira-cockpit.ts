import type { JiraCurrentContext } from "./jira-context.ts";

export type JiraCockpitMode = "compact" | "focus";

export interface JiraCockpitState {
  project?: {
    key: string;
    name?: string;
  };
  board?: {
    id: number;
    name?: string;
    scope?: "active sprint" | "saved filter" | "none";
  };
  filter?: {
    summary: string;
    total?: number;
    returned?: number;
    startAt?: number;
  };
  focusedIssue?: {
    key: string;
    summary: string;
    status: string;
    priority?: string;
    assignee?: string;
  };
  status?: {
    kind: "ok" | "warning" | "error";
    message: string;
  };
}

export function cockpitStateFromContext(
  context: JiraCurrentContext,
  overrides: Partial<JiraCockpitState> = {},
): JiraCockpitState {
  return {
    project: context.project,
    board: context.board,
    filter: context.filterSummary ? { summary: context.filterSummary } : undefined,
    focusedIssue: context.focusedIssue?.status
      ? {
          key: context.focusedIssue.key,
          summary: context.focusedIssue.summary,
          status: context.focusedIssue.status,
          priority: context.focusedIssue.priority,
          assignee: context.focusedIssue.assignee,
        }
      : undefined,
    ...overrides,
  };
}

export function renderJiraCockpitWidget(state: JiraCockpitState, mode: JiraCockpitMode): string[] {
  if (!state.project && !state.board && !state.filter && !state.focusedIssue) {
    return ["Jira · unavailable", `Status: ${state.status?.message ?? "not configured"}`, "Actions: /jira-onboarding"];
  }

  return mode === "focus" ? renderFocus(state) : renderCompact(state);
}

function renderCompact(state: JiraCockpitState): string[] {
  const lines = [cockpitTitle(state)];
  lines.push(`Filter: ${filterLine(state)}`);
  lines.push(`Issue: ${focusedIssueLine(state)}`);
  if (state.status) lines.push(`Status: ${state.status.message}`);
  lines.push("Actions: /jira · /jira-issues · /jira-refresh");
  return lines;
}

function renderFocus(state: JiraCockpitState): string[] {
  const lines = [cockpitTitle(state), `Filter: ${state.filter?.summary ?? "none"}`, ""];

  if (state.focusedIssue) {
    const issue = state.focusedIssue;
    lines.push(`${issue.key}  ${issue.status}${issue.priority ? `  ${issue.priority}` : ""}`);
    lines.push(issue.summary);
    lines.push(`assignee: ${issue.assignee ?? "unassigned"}`);
  } else {
    lines.push("Focused issue: none");
  }

  lines.push("", "Actions: /jira-plan · /jira-fix · /jira-transition");
  return lines;
}

function cockpitTitle(state: JiraCockpitState): string {
  const project = state.project ? `${state.project.key}${state.project.name ? ` ${state.project.name}` : ""}` : "no project";
  const board = state.board ? `Board ${state.board.name ?? state.board.id}` : "Board none";
  return `Jira · ${project} · ${board}`;
}

function filterLine(state: JiraCockpitState): string {
  const parts = [state.filter?.summary ?? "none"];
  if (state.filter?.returned !== undefined && state.filter.total !== undefined) {
    parts.push(`Issues ${state.filter.returned}/${state.filter.total}`);
  }
  if (state.filter?.startAt !== undefined) {
    parts.push(`startAt ${state.filter.startAt}`);
  }
  return parts.join(" · ");
}

function focusedIssueLine(state: JiraCockpitState): string {
  if (!state.focusedIssue) return "none";
  return `${state.focusedIssue.key} ${state.focusedIssue.status}`;
}
