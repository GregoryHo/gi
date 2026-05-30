import type { JiraConfig } from "../config/index.ts";
import { jiraApiFetch } from "./client.ts";

export interface JiraProjectVersion {
  id: string;
  name: string;
  archived?: boolean;
  released?: boolean;
  releaseDate?: string;
  startDate?: string;
  sequence?: number;
}

export interface JiraProjectComponent {
  id: string;
  name: string;
}

export interface JiraProjectIssueType {
  id: string;
  name: string;
  subtask?: boolean;
}

export function buildProjectVersionsPath(projectKey: string): string {
  return `/project/${encodeURIComponent(projectKey)}/versions`;
}

export function buildProjectComponentsPath(projectKey: string): string {
  return `/project/${encodeURIComponent(projectKey)}/components`;
}

export function buildProjectIssueTypesPath(projectKey: string): string {
  return `/project/${encodeURIComponent(projectKey)}/statuses`;
}

export function sortProjectVersionsForPicker(versions: JiraProjectVersion[]): JiraProjectVersion[] {
  return [...versions].sort((left, right) => {
    if (Boolean(left.archived) !== Boolean(right.archived)) return left.archived ? 1 : -1;
    if (Boolean(left.released) !== Boolean(right.released)) return left.released ? 1 : -1;

    const rightDate = dateRank(right);
    const leftDate = dateRank(left);
    if (rightDate !== leftDate) return rightDate - leftDate;

    const rightSequence = right.sequence ?? Number(right.id);
    const leftSequence = left.sequence ?? Number(left.id);
    if (Number.isFinite(rightSequence) && Number.isFinite(leftSequence) && rightSequence !== leftSequence) {
      return rightSequence - leftSequence;
    }

    return right.name.localeCompare(left.name);
  });
}

export async function fetchProjectVersions(
  config: JiraConfig,
  projectKey: string,
  signal?: AbortSignal,
): Promise<JiraProjectVersion[]> {
  const versions = await jiraApiFetch<JiraProjectVersion[]>(config, buildProjectVersionsPath(projectKey), { signal });
  return versions.map((version) => ({
    id: String(version.id),
    name: version.name,
    archived: version.archived,
    released: version.released,
    ...(version.releaseDate ? { releaseDate: version.releaseDate } : {}),
    ...(version.startDate ? { startDate: version.startDate } : {}),
    ...(version.sequence !== undefined ? { sequence: version.sequence } : {}),
  }));
}

function dateRank(version: JiraProjectVersion): number {
  const raw = version.releaseDate ?? version.startDate;
  return raw ? Date.parse(raw) || 0 : 0;
}

export async function fetchProjectIssueTypes(
  config: JiraConfig,
  projectKey: string,
  signal?: AbortSignal,
): Promise<JiraProjectIssueType[]> {
  const issueTypes = await jiraApiFetch<JiraProjectIssueType[]>(config, buildProjectIssueTypesPath(projectKey), { signal });
  return issueTypes.map((issueType) => ({
    id: String(issueType.id),
    name: issueType.name,
    ...(issueType.subtask !== undefined ? { subtask: issueType.subtask } : {}),
  }));
}

export async function fetchProjectComponents(
  config: JiraConfig,
  projectKey: string,
  signal?: AbortSignal,
): Promise<JiraProjectComponent[]> {
  const components = await jiraApiFetch<JiraProjectComponent[]>(config, buildProjectComponentsPath(projectKey), { signal });
  return components.map((component) => ({ id: String(component.id), name: component.name }));
}
