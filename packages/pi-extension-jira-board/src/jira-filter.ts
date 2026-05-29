export type IssueStatusMode = "notDone" | "all" | "done";

export interface GuidedIssueFilters {
  project: string;
  fixVersion?: string;
  component?: string;
  assignee?: string;
  text?: string;
  statusMode?: IssueStatusMode;
}

export type JiraIssuesArgs =
  | { mode: "guided" }
  | { mode: "project"; project: string }
  | { mode: "jql"; jql: string };

export function parseJiraIssuesArgs(args: string | undefined): JiraIssuesArgs {
  const trimmed = args?.trim();
  if (!trimmed) return { mode: "guided" };

  if (trimmed.startsWith("--jql ")) {
    return { mode: "jql", jql: trimmed.slice("--jql ".length).trim() };
  }

  if (/^[A-Z][A-Z0-9_]*$/i.test(trimmed)) {
    return { mode: "project", project: trimmed.toUpperCase() };
  }

  return { mode: "jql", jql: trimmed };
}

export function buildGuidedIssueJql(filters: GuidedIssueFilters): string {
  const clauses = [`project = ${quoteJqlValue(filters.project)}`];

  if (filters.fixVersion?.trim()) clauses.push(`fixVersion = ${quoteJqlValue(filters.fixVersion.trim())}`);
  if (filters.component?.trim()) clauses.push(`component = ${quoteJqlValue(filters.component.trim())}`);
  if (filters.assignee?.trim()) clauses.push(`assignee = ${quoteJqlValue(filters.assignee.trim())}`);
  if (filters.text?.trim()) clauses.push(`text ~ ${quoteJqlValue(filters.text.trim())}`);

  const statusMode = filters.statusMode ?? "notDone";
  if (statusMode === "notDone") clauses.push("statusCategory != Done");
  if (statusMode === "done") clauses.push("statusCategory = Done");

  return `${clauses.join(" AND ")} ORDER BY updated DESC`;
}

export function quoteJqlValue(value: string): string {
  if (/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) return value;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
