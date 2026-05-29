import { applyJiraRuntimeContext, getActiveJiraProjectKey } from "./jira-context.ts";
import { JiraConfigError, loadJiraConfig } from "./config.ts";
import { mapJiraIssue, type CompactJiraIssue } from "./issue-mapper.ts";
import { jiraApiFetch } from "./jira-client.ts";
import { buildSearchPath } from "./jira-tools.ts";
import type { JiraSearchResult } from "./jira-types.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  fuzzyFilter,
  type AutocompleteItem,
  type AutocompleteProvider,
  type AutocompleteSuggestions,
} from "@earendil-works/pi-tui";

const MAX_AUTOCOMPLETE_ISSUES = 50;
export const MAX_AUTOCOMPLETE_SUGGESTIONS = 20;

export interface JiraAutocompleteToken {
  prefix: string;
  query: string;
  shorthand: boolean;
}

export function extractJiraAutocompleteToken(
  textBeforeCursor: string,
  defaultProject?: string,
): JiraAutocompleteToken | undefined {
  const shorthandMatch = textBeforeCursor.match(/(?:^|[\s(])#(\d*)$/);
  if (shorthandMatch && defaultProject) {
    const numberPart = shorthandMatch[1] ?? "";
    return {
      prefix: `#${numberPart}`,
      query: `${defaultProject}-${numberPart}`,
      shorthand: true,
    };
  }

  const keyMatch = textBeforeCursor.match(/(?:^|[\s(])([A-Z][A-Z0-9_]+-\d*)$/i);
  if (!keyMatch?.[1]) return undefined;

  return {
    prefix: keyMatch[1],
    query: keyMatch[1].toUpperCase(),
    shorthand: false,
  };
}

function issueSuggestion(issue: CompactJiraIssue): AutocompleteItem {
  return {
    value: issue.key,
    label: issue.key,
    description: `[${issue.status}] ${issue.summary}`,
  };
}

export function filterJiraIssueSuggestions(issues: CompactJiraIssue[], query: string): AutocompleteItem[] {
  const normalizedQuery = query.toUpperCase();
  const prefixMatches = issues.filter((issue) => issue.key.toUpperCase().startsWith(normalizedQuery));

  const matches =
    prefixMatches.length > 0
      ? prefixMatches
      : fuzzyFilter(issues, query, (issue) => `${issue.key} ${issue.summary}`);

  return matches.slice(0, MAX_AUTOCOMPLETE_SUGGESTIONS).map(issueSuggestion);
}

export function createJiraAutocompleteProvider(
  current: AutocompleteProvider,
  getIssues: () => Promise<CompactJiraIssue[] | undefined>,
  defaultProject?: string | (() => string | undefined),
): AutocompleteProvider {
  return {
    async getSuggestions(lines, cursorLine, cursorCol, options): Promise<AutocompleteSuggestions | null> {
      const line = lines[cursorLine] ?? "";
      const textBeforeCursor = line.slice(0, cursorCol);
      const resolvedDefaultProject = typeof defaultProject === "function" ? defaultProject() : defaultProject;
      const token = extractJiraAutocompleteToken(textBeforeCursor, resolvedDefaultProject);
      if (!token) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      const issues = await getIssues();
      if (options.signal.aborted || !issues || issues.length === 0) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      const suggestions = filterJiraIssueSuggestions(issues, token.query);
      if (suggestions.length === 0) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      return {
        prefix: token.prefix,
        items: suggestions,
      };
    },

    applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
      return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
    },

    shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
      return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
    },
  };
}

async function loadRecentIssues(signal?: AbortSignal): Promise<CompactJiraIssue[] | undefined> {
  const config = applyJiraRuntimeContext(loadJiraConfig());
  if (!config.project) return undefined;

  const jql = `project = ${config.project} AND statusCategory != Done ORDER BY updated DESC`;
  const result = await jiraApiFetch<JiraSearchResult>(
    config,
    buildSearchPath({ jql, maxResults: MAX_AUTOCOMPLETE_ISSUES }),
    { signal },
  );

  return result.issues.map((issue) => mapJiraIssue(issue, config.baseUrl, { includeDescription: false }));
}

export function registerJiraAutocomplete(pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;

    let issuesPromise: Promise<CompactJiraIssue[] | undefined> | undefined;
    let issuesProject: string | undefined;
    let loadErrorShown = false;
    let defaultProject: string | undefined;

    try {
      defaultProject = loadJiraConfig().project;
    } catch (error) {
      if (error instanceof JiraConfigError) return;
      throw error;
    }

    const getIssues = async (): Promise<CompactJiraIssue[] | undefined> => {
      const activeProject = getActiveJiraProjectKey() ?? defaultProject;
      if (issuesProject !== activeProject) {
        issuesProject = activeProject;
        issuesPromise = undefined;
      }
      issuesPromise ||= loadRecentIssues(ctx.signal).catch((error: unknown) => {
        if (!loadErrorShown) {
          loadErrorShown = true;
          ctx.ui.notify(
            `jira autocomplete: failed to load recent issues: ${error instanceof Error ? error.message : String(error)}`,
            "warning",
          );
        }
        return undefined;
      });
      return issuesPromise;
    };

    void getIssues();
    ctx.ui.addAutocompleteProvider((current) =>
      createJiraAutocompleteProvider(current, getIssues, () => getActiveJiraProjectKey() ?? defaultProject),
    );
  });
}
