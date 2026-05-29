import type { JiraConfig } from "./config.ts";
import type { CompactJiraIssue } from "./issue-mapper.ts";
import type { JiraProject } from "./jira-types.ts";

export const JIRA_CONTEXT_ENTRY_TYPE = "jira-board-context";

export interface ActiveJiraBoardFilterScope {
  filterId: string;
  name?: string;
  jql?: string;
}

export interface ActiveJiraBoard {
  id: number;
  name?: string;
  type?: string;
  projectKey?: string;
  filterScope?: ActiveJiraBoardFilterScope;
}

export interface FocusedJiraIssueState {
  key: string;
  summary: string;
  status?: string;
  priority?: string;
  assignee?: string;
}

export interface JiraRuntimeContextSnapshot {
  activeProject?: JiraProject;
  activeBoard?: ActiveJiraBoard;
  filterSummary?: string;
  focusedIssue?: FocusedJiraIssueState;
}

export interface JiraCurrentContext {
  project?: JiraProject | { key: string };
  board?: ActiveJiraBoard;
  boardId?: number;
  filterSummary?: string;
  focusedIssue?: FocusedJiraIssueState;
}

let activeProject: JiraProject | undefined;
let activeBoard: ActiveJiraBoard | undefined;
let filterSummary: string | undefined;
let focusedIssue: FocusedJiraIssueState | undefined;

export function setActiveJiraProject(project: JiraProject): void {
  activeProject = project;
}

export function getActiveJiraProject(): JiraProject | undefined {
  return activeProject;
}

export function getActiveJiraProjectKey(): string | undefined {
  return activeProject?.key;
}

export function setActiveJiraBoard(board: ActiveJiraBoard): void {
  activeBoard = board;
}

export function getActiveJiraBoard(): ActiveJiraBoard | undefined {
  return activeBoard;
}

export function setJiraIssueFilterSummary(summary: string | undefined): void {
  filterSummary = summary;
}

export function setFocusedJiraIssue(issue: CompactJiraIssue): void {
  focusedIssue = {
    key: issue.key,
    summary: issue.summary,
    status: issue.status,
    priority: issue.priority,
    assignee: issue.assignee,
  };
}

export function getFocusedJiraIssueKey(): string | undefined {
  return focusedIssue?.key;
}

export function getFocusedJiraIssueKeyOrThrow(): string {
  if (!focusedIssue) {
    throw new Error("No focused Jira issue. Use /jira-issues to focus an issue first.");
  }
  return focusedIssue.key;
}

export function clearJiraRuntimeContext(): void {
  activeProject = undefined;
  activeBoard = undefined;
  filterSummary = undefined;
  focusedIssue = undefined;
}

export function applyJiraRuntimeContext(config: JiraConfig): JiraConfig {
  if (!activeProject) return config;
  return { ...config, project: activeProject.key };
}

export function getJiraCurrentContext(config?: JiraConfig): JiraCurrentContext {
  const project = activeProject ?? (config?.project ? { key: config.project } : undefined);
  const board = activeBoard ?? (config?.boardId === undefined ? undefined : { id: config.boardId });
  return {
    project,
    board,
    boardId: config?.boardId,
    filterSummary,
    focusedIssue,
  };
}

export function formatJiraCurrentContext(context: JiraCurrentContext): string {
  const lines = ["Current Jira context:"];
  if (context.project) {
    const projectName = "name" in context.project && context.project.name ? ` ${context.project.name}` : "";
    lines.push(`Project: ${context.project.key}${projectName}`);
  } else {
    lines.push("Project: none");
  }
  lines.push(`Board: ${formatBoard(context.board)}`);
  lines.push(`Filter: ${context.filterSummary ?? "none"}`);
  if (context.focusedIssue) {
    const status = context.focusedIssue.status ? ` ${context.focusedIssue.status}` : "";
    lines.push(`Focused issue: ${context.focusedIssue.key}${status}`);
    lines.push(context.focusedIssue.summary);
  } else {
    lines.push("Focused issue: none");
  }
  return lines.join("\n");
}

function formatBoard(board: ActiveJiraBoard | undefined): string {
  if (!board) return "none";
  if (board.name) {
    const type = board.type ? `, ${board.type}` : "";
    const filter = board.filterScope?.name ? `, filter: ${board.filterScope.name}` : "";
    return `${board.name} (#${board.id}${type}${filter})`;
  }
  return String(board.id);
}

export function captureJiraRuntimeContext(): JiraRuntimeContextSnapshot {
  return {
    activeProject,
    activeBoard,
    filterSummary,
    focusedIssue,
  };
}

export function restoreJiraRuntimeContext(snapshot: JiraRuntimeContextSnapshot): void {
  activeProject = snapshot.activeProject;
  activeBoard = snapshot.activeBoard;
  filterSummary = snapshot.filterSummary;
  focusedIssue = snapshot.focusedIssue;
}

export function restoreJiraRuntimeContextFromEntries(entries: Iterable<unknown>): void {
  clearJiraRuntimeContext();
  for (const entry of entries) {
    if (!isJiraContextEntry(entry)) continue;
    restoreJiraRuntimeContext(entry.data);
  }
}

function isJiraContextEntry(entry: unknown): entry is {
  type: "custom";
  customType: typeof JIRA_CONTEXT_ENTRY_TYPE;
  data: JiraRuntimeContextSnapshot;
} {
  if (!entry || typeof entry !== "object") return false;
  const candidate = entry as { type?: unknown; customType?: unknown; data?: unknown };
  return candidate.type === "custom" && candidate.customType === JIRA_CONTEXT_ENTRY_TYPE && Boolean(candidate.data);
}
