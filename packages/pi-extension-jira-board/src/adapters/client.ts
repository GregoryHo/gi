import type { JiraConfig } from "../config/index.ts";
import type { JiraCurrentUser } from "../types.ts";

export interface JiraConnectivityResult {
  ok: true;
  userLabel: string;
}

function basicAuth(config: JiraConfig): string {
  return `Basic ${Buffer.from(`${config.user}:${config.secret}`).toString("base64")}`;
}

function buildHeaders(config: JiraConfig, inputHeaders?: HeadersInit): Headers {
  const headers = new Headers(inputHeaders);
  headers.set("Authorization", basicAuth(config));
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return headers;
}

function sanitizeSnippet(body: string, config: JiraConfig): string {
  const redacted = body.replaceAll(config.user, "[redacted]").replaceAll(config.secret, "[redacted]");
  const compact = redacted.replace(/\s+/g, " ").trim();
  if (compact.length <= 160) return compact;
  return `${compact.slice(0, 160)}…`;
}

async function jiraFetch<T>(
  apiName: "Jira API" | "Jira Agile API",
  basePath: "/rest/api/2" | "/rest/agile/1.0",
  config: JiraConfig,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const method = options.method ?? "GET";
  const response = await fetch(`${config.baseUrl}${basePath}${normalizedPath}`, {
    ...options,
    headers: buildHeaders(config, options.headers),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const snippet = sanitizeSnippet(body, config);
    const suffix = snippet ? `: ${snippet}` : "";
    throw new Error(`${apiName} ${method} ${normalizedPath} failed (${response.status})${suffix}`);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (!text.trim()) return undefined as T;
  return JSON.parse(text) as T;
}

export function jiraApiFetch<T>(config: JiraConfig, path: string, options: RequestInit = {}): Promise<T> {
  return jiraFetch<T>("Jira API", "/rest/api/2", config, path, options);
}

export function jiraAgileFetch<T>(config: JiraConfig, path: string, options: RequestInit = {}): Promise<T> {
  return jiraFetch<T>("Jira Agile API", "/rest/agile/1.0", config, path, options);
}

export async function validateJiraConnectivity(
  config: JiraConfig,
  options: RequestInit = {},
): Promise<JiraConnectivityResult> {
  const user = await jiraApiFetch<JiraCurrentUser>(config, "/myself", options);
  return {
    ok: true,
    userLabel: user.displayName ?? user.name ?? user.key ?? user.emailAddress ?? "authenticated user",
  };
}
