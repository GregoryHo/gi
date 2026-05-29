import { readLocalJiraConfigSync, type LocalJiraConfigOptions } from "./local-config.ts";

export interface JiraConfig {
  baseUrl: string;
  user: string;
  secret: string;
  project?: string;
  boardId?: number;
}

export interface JiraConfigSummary {
  baseUrl: string;
  project: string;
  boardId: string;
  userConfigured: boolean;
  secretConfigured: boolean;
}

export class JiraConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JiraConfigError";
  }
}

export function loadJiraConfig(env: NodeJS.ProcessEnv = process.env, options: LocalJiraConfigOptions = {}): JiraConfig {
  const baseUrl = env.JIRA_BASE_URL?.trim().replace(/\/+$/, "");
  const user = (env.JIRA_USER || env.JIRA_EMAIL)?.trim();
  const secret = env.JIRA_TOKEN || env.JIRA_PASSWORD;
  const hasRequiredEnvInput = Boolean(baseUrl || user || secret);

  if (!hasRequiredEnvInput) {
    try {
      return readLocalJiraConfigSync(options);
    } catch (error) {
      const missing = "JIRA_BASE_URL, JIRA_USER or JIRA_EMAIL, JIRA_TOKEN or JIRA_PASSWORD";
      const suffix = error instanceof Error ? ` ${error.message}` : " Run /jira-onboarding to configure Jira.";
      throw new JiraConfigError(`Missing Jira configuration: ${missing}.${suffix}`);
    }
  }

  const missing: string[] = [];
  if (!baseUrl) missing.push("JIRA_BASE_URL");
  if (!user) missing.push("JIRA_USER or JIRA_EMAIL");
  if (!secret) missing.push("JIRA_TOKEN or JIRA_PASSWORD");

  if (missing.length > 0) {
    throw new JiraConfigError(`Missing Jira configuration: ${missing.join(", ")}`);
  }

  const boardId = parseOptionalBoardId(env.JIRA_BOARD_ID);

  return {
    baseUrl: baseUrl as string,
    user: user as string,
    secret: secret as string,
    project: env.JIRA_PROJECT?.trim() || undefined,
    boardId,
  };
}

export function parseOptionalBoardId(value: string | undefined): number | undefined {
  const boardIdText = value?.trim();
  if (!boardIdText) return undefined;

  const boardId = Number(boardIdText);
  if (!Number.isInteger(boardId) || boardId <= 0) {
    throw new JiraConfigError("Invalid JIRA_BOARD_ID: expected a positive integer");
  }
  return boardId;
}

export function summarizeJiraConfig(config: JiraConfig): JiraConfigSummary {
  return {
    baseUrl: config.baseUrl,
    project: config.project ?? "not configured",
    boardId: config.boardId === undefined ? "not configured" : String(config.boardId),
    userConfigured: Boolean(config.user),
    secretConfigured: Boolean(config.secret),
  };
}
