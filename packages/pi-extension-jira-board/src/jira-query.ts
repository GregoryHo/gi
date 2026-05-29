import type { JiraConfig } from "./config.ts";
import { jiraApiFetch } from "./jira-client.ts";
import type { JiraProject } from "./jira-types.ts";

const DEFAULT_PROJECT_RESULTS = 25;
export const MAX_PROJECT_RESULTS = 50;

export interface JiraSearchProjectsParams {
  query?: string;
  startAt?: number;
  maxResults?: number;
}

export interface ResolvedProjectQueryParams {
  query?: string;
  startAt: number;
  maxResults: number;
}

export interface JiraProjectPage {
  query?: string;
  startAt: number;
  maxResults: number;
  total: number;
  returned: number;
  isLast: boolean;
  projects: JiraProject[];
}

export function resolveProjectQueryParams(params: JiraSearchProjectsParams = {}): ResolvedProjectQueryParams {
  const query = params.query?.trim() || undefined;
  const startAt = normalizeStartAt(params.startAt);
  const maxResults = normalizeMaxResults(params.maxResults, DEFAULT_PROJECT_RESULTS, MAX_PROJECT_RESULTS);

  return { query, startAt, maxResults };
}

export function buildProjectListPath(): string {
  return "/project";
}

export function pageProjects(projects: JiraProject[], params: JiraSearchProjectsParams = {}): JiraProjectPage {
  const resolved = resolveProjectQueryParams(params);
  const filtered = filterProjects(projects, resolved.query);
  const page = filtered.slice(resolved.startAt, resolved.startAt + resolved.maxResults);
  const nextIndex = resolved.startAt + page.length;

  return {
    query: resolved.query,
    startAt: resolved.startAt,
    maxResults: resolved.maxResults,
    total: filtered.length,
    returned: page.length,
    isLast: nextIndex >= filtered.length,
    projects: page.map(compactProject),
  };
}

export async function queryJiraProjects(
  config: JiraConfig,
  params: JiraSearchProjectsParams = {},
  signal?: AbortSignal,
): Promise<JiraProjectPage> {
  const projects = await jiraApiFetch<JiraProject[]>(config, buildProjectListPath(), { signal });
  return pageProjects(projects, params);
}

export function formatProjectList(page: JiraProjectPage): string {
  const lines = [
    `Jira projects returned ${page.returned} of ${page.total} project(s).`,
    `Page: startAt ${page.startAt}, maxResults ${page.maxResults}, isLast ${page.isLast}`,
  ];

  if (page.query) lines.push(`Filter: ${page.query}`);
  lines.push("");

  for (const project of page.projects) {
    lines.push(`- ${project.key}: ${project.name}`);
  }

  return lines.join("\n").trimEnd();
}

export function normalizeStartAt(startAt: number | undefined): number {
  const requested = startAt ?? 0;
  return Math.max(0, Math.floor(requested));
}

export function normalizeMaxResults(maxResults: number | undefined, defaultValue: number, cap: number): number {
  const requested = maxResults ?? defaultValue;
  return Math.max(1, Math.min(Math.floor(requested), cap));
}

function filterProjects(projects: JiraProject[], query: string | undefined): JiraProject[] {
  if (!query) return projects;
  const normalized = query.toLocaleLowerCase();
  return projects.filter((project) => {
    return project.key.toLocaleLowerCase().includes(normalized) || project.name.toLocaleLowerCase().includes(normalized);
  });
}

function compactProject(project: JiraProject): JiraProject {
  return {
    id: String(project.id),
    key: project.key,
    name: project.name,
  };
}
