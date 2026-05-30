import type { JiraIssue } from "../types.ts";

export const DESCRIPTION_LIMIT = 2000;
const TRUNCATION_MARKER = "\n\n[Description truncated]";

export interface CompactJiraIssue {
  key: string;
  url: string;
  summary: string;
  status: string;
  statusCategory: string;
  issueType?: string;
  priority?: string;
  assignee?: string;
  labels: string[];
  description?: string;
  descriptionTruncated: boolean;
}

export interface MapJiraIssueOptions {
  includeDescription?: boolean;
}

function truncateDescription(description: string): { description: string; truncated: boolean } {
  if (description.length <= DESCRIPTION_LIMIT) {
    return { description, truncated: false };
  }

  return {
    description: `${description.slice(0, DESCRIPTION_LIMIT)}${TRUNCATION_MARKER}`,
    truncated: true,
  };
}

function assigneeLabel(issue: JiraIssue): string | undefined {
  const assignee = issue.fields.assignee;
  return assignee?.displayName ?? assignee?.emailAddress ?? assignee?.name;
}

export function mapJiraIssue(
  issue: JiraIssue,
  baseUrl: string,
  options: MapJiraIssueOptions = {},
): CompactJiraIssue {
  const includeDescription = options.includeDescription ?? true;
  const rawDescription = issue.fields.description ?? "";
  const description = includeDescription && rawDescription ? truncateDescription(rawDescription) : undefined;

  return {
    key: issue.key,
    url: `${baseUrl}/browse/${issue.key}`,
    summary: issue.fields.summary,
    status: issue.fields.status.name,
    statusCategory: issue.fields.status.statusCategory.key,
    issueType: issue.fields.issuetype?.name,
    priority: issue.fields.priority?.name,
    assignee: assigneeLabel(issue),
    labels: issue.fields.labels ?? [],
    ...(description ? { description: description.description } : {}),
    descriptionTruncated: description?.truncated ?? false,
  };
}

export function formatIssueSummary(issue: CompactJiraIssue): string {
  const lines = [
    `## ${issue.key}: ${issue.summary}`,
    `URL: ${issue.url}`,
    `Status: ${issue.status} (${issue.statusCategory})`,
  ];

  if (issue.issueType) lines.push(`Type: ${issue.issueType}`);
  if (issue.priority) lines.push(`Priority: ${issue.priority}`);
  if (issue.assignee) lines.push(`Assignee: ${issue.assignee}`);
  if (issue.labels.length > 0) lines.push(`Labels: ${issue.labels.join(", ")}`);

  if (issue.description) {
    lines.push("", "### Description", issue.description);
  }

  return lines.join("\n");
}

export function formatIssueList(issues: CompactJiraIssue[], total: number, jql: string): string {
  const lines = [`Jira search returned ${issues.length} of ${total} issue(s).`, `JQL: ${jql}`, ""];

  for (const issue of issues) {
    const meta = [issue.status, issue.priority, issue.assignee].filter(Boolean).join(" • ");
    lines.push(`- ${issue.key}: ${issue.summary}${meta ? ` (${meta})` : ""}`);
    if (issue.description) {
      lines.push(`  Description: ${issue.description.replace(/\s+/g, " ")}`);
    }
  }

  return lines.join("\n").trimEnd();
}
