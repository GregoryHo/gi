import { getFocusedJiraIssueKey } from "../state/context.ts";

const ISSUE_KEY_PATTERN = /\b[A-Z][A-Z0-9_]+-\d+\b/i;

export type CommandIssueKeySource = "explicit" | "focused" | "missing";

export interface ResolvedCommandIssueKey {
  issueKey?: string;
  source: CommandIssueKeySource;
}

export function parseCommandIssueKey(args: string): string | undefined {
  return args.match(ISSUE_KEY_PATTERN)?.[0]?.toUpperCase();
}

export function resolveCommandIssueKey(args: string): ResolvedCommandIssueKey {
  const explicit = parseCommandIssueKey(args);
  if (explicit) return { issueKey: explicit, source: "explicit" };

  const focused = getFocusedJiraIssueKey();
  if (focused) return { issueKey: focused, source: "focused" };

  return { issueKey: undefined, source: "missing" };
}

export function usageWithFocusedIssue(command: string): string {
  return `Usage: /${command} [ISSUE-KEY] or focus an issue with /jira-issues first.`;
}
