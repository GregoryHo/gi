import type { CompactJiraIssue } from "./issue-mapper.ts";

const ISSUE_KEY_PATTERN = /\b[A-Z][A-Z0-9_]+-\d+\b/i;

export function extractIssueKey(args: string): string | undefined {
  const match = args.match(ISSUE_KEY_PATTERN);
  return match?.[0]?.toUpperCase();
}

function issueContext(issue: CompactJiraIssue): string {
  const lines = [
    `- Key: ${issue.key}`,
    `- URL: ${issue.url}`,
    `- Summary: ${issue.summary}`,
    `- Status: ${issue.status} (${issue.statusCategory})`,
  ];

  if (issue.issueType) lines.push(`- Type: ${issue.issueType}`);
  if (issue.priority) lines.push(`- Priority: ${issue.priority}`);
  if (issue.assignee) lines.push(`- Assignee: ${issue.assignee}`);
  if (issue.labels.length > 0) lines.push(`- Labels: ${issue.labels.join(", ")}`);
  if (issue.description) {
    lines.push("", "## Jira description", issue.description);
    if (issue.descriptionTruncated) lines.push("", "Note: the Jira description was truncated.");
  }

  return lines.join("\n");
}

export function buildImplementationPlanPrompt(issue: CompactJiraIssue): string {
  return [
    `Create an implementation plan for Jira issue ${issue.key}.`,
    "",
    "Use the Jira context below, then inspect the repository before proposing code changes.",
    "Do not implement yet unless explicitly asked after the plan.",
    "",
    "## Jira context",
    issueContext(issue),
    "",
    "## Required output",
    "1. Problem summary",
    "2. Assumptions from the ticket",
    "3. Unknowns and clarifying questions",
    "4. Likely affected modules/files to inspect",
    "5. Implementation plan with small executable steps",
    "6. Test plan, including regression and edge-case coverage",
    "7. Risks, rollout/rollback, and verification notes",
  ].join("\n");
}

export function buildFixPlanPrompt(issue: CompactJiraIssue): string {
  return [
    `Create a Bug-fix plan for Jira issue ${issue.key}.`,
    "",
    "Use the Jira context below, then inspect the repository before proposing code changes.",
    "Focus on root-cause analysis before implementation. Do not implement yet unless explicitly asked after the plan.",
    "",
    "## Jira context",
    issueContext(issue),
    "",
    "## Required output",
    "1. Symptom summary",
    "2. Reproduction and evidence-gathering plan",
    "3. Root-cause investigation plan",
    "4. Minimal fix strategy",
    "5. Regression tests and edge-case tests",
    "6. Risks and verification notes",
    "7. Unknowns and clarifying questions",
  ].join("\n");
}

export function formatIssueWidgetLines(issue: CompactJiraIssue): string[] {
  const meta = [`Status: ${issue.status}`];
  if (issue.issueType) meta.push(`Type: ${issue.issueType}`);
  if (issue.priority) meta.push(`Priority: ${issue.priority}`);

  const lines = [`Jira ${issue.key}`, issue.summary, meta.join(" | ")];
  if (issue.assignee) lines.push(`Assignee: ${issue.assignee}`);
  if (issue.labels.length > 0) lines.push(`Labels: ${issue.labels.join(", ")}`);
  return lines;
}
