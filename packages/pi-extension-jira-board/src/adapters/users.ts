import type { JiraConfig } from "../config/index.ts";
import { jiraApiFetch } from "./client.ts";
import type { FacetValueItem } from "../ui/facet-picker.ts";

export interface JiraAssignableUser {
  name?: string;
  displayName?: string;
  emailAddress?: string;
}

export function buildAssignableUsersPath(params: {
  project: string;
  query: string;
  maxResults?: number;
}): string {
  const query = new URLSearchParams({
    project: params.project,
    username: params.query,
    maxResults: String(Math.max(1, Math.min(Math.floor(params.maxResults ?? 50), 50))),
  });
  return `/user/assignable/search?${query.toString()}`;
}

export function userFacetValue(user: JiraAssignableUser): FacetValueItem {
  const value = user.name ?? user.emailAddress ?? user.displayName ?? "";
  const label = user.displayName ?? user.name ?? user.emailAddress ?? value;
  const description = [user.name, user.emailAddress].filter(Boolean).join(" · ");
  return {
    value,
    label,
    ...(description ? { description } : {}),
  };
}

export function rankAssignableUsers(users: JiraAssignableUser[], query: string): JiraAssignableUser[] {
  return [...users].sort((left, right) => userRank(left, query) - userRank(right, query));
}

function userRank(user: JiraAssignableUser, query: string): number {
  const normalizedQuery = normalize(query);
  const name = normalize(user.name);
  const displayName = normalize(user.displayName);
  const email = normalize(user.emailAddress);

  if (name === normalizedQuery) return 0;
  if (name.startsWith(normalizedQuery)) return 1;
  if (displayName === normalizedQuery || email === normalizedQuery) return 2;
  if (displayName.includes(normalizedQuery) || email.includes(normalizedQuery)) return 3;
  return 4;
}

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[\s._-]+/g, "_");
}

export async function fetchAssignableUsers(
  config: JiraConfig,
  project: string,
  query: string,
  signal?: AbortSignal,
): Promise<FacetValueItem[]> {
  const users = await jiraApiFetch<JiraAssignableUser[]>(
    config,
    buildAssignableUsersPath({ project, query, maxResults: 50 }),
    { signal },
  );
  return rankAssignableUsers(users, query).map(userFacetValue).filter((user) => user.value);
}
