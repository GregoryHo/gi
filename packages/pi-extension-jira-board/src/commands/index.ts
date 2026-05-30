import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { loadJiraConfig } from "../config/index.ts";
import { cockpitStateFromContext, renderJiraCockpitWidget } from "../ui/cockpit.ts";
import {
  JIRA_CONTEXT_ENTRY_TYPE,
  applyJiraRuntimeContext,
  captureJiraRuntimeContext,
  getJiraCurrentContext,
  setFocusedJiraIssue,
} from "../state/context.ts";
import { buildIssuePath } from "../tools/index.ts";
import { jiraApiFetch } from "../adapters/client.ts";
import { resolveCommandIssueKey, usageWithFocusedIssue } from "../core/command-issue.ts";
import type { JiraIssue } from "../types.ts";
import { formatIssueSummary, mapJiraIssue, type CompactJiraIssue } from "../core/issue-mapper.ts";
import { buildFixPlanPrompt, buildImplementationPlanPrompt } from "../core/planning-prompts.ts";

async function fetchCompactIssue(issueKey: string, signal?: AbortSignal): Promise<CompactJiraIssue> {
  const config = applyJiraRuntimeContext(loadJiraConfig());
  const issue = await jiraApiFetch<JiraIssue>(config, buildIssuePath(issueKey), { signal });
  return mapJiraIssue(issue, config.baseUrl, { includeDescription: true });
}

export function registerJiraCommands(pi: ExtensionAPI, widgetName: string): void {
  pi.registerCommand("jira-issue", {
    description: "Fetch and display compact Jira issue context",
    handler: async (args, ctx) => {
      const { issueKey } = resolveCommandIssueKey(args);
      if (!issueKey) {
        if (ctx.hasUI) ctx.ui.notify(usageWithFocusedIssue("jira-issue"), "warning");
        return;
      }

      try {
        const issue = await fetchCompactIssue(issueKey, ctx.signal);
        setFocusedJiraIssue(issue);
        pi.appendEntry(JIRA_CONTEXT_ENTRY_TYPE, captureJiraRuntimeContext());
        if (ctx.hasUI) {
          const config = applyJiraRuntimeContext(loadJiraConfig());
          ctx.ui.setWidget(widgetName, renderJiraCockpitWidget(cockpitStateFromContext(getJiraCurrentContext(config)), "focus"));
          ctx.ui.notify(`Loaded ${issue.key}`, "info");
        } else {
          pi.sendMessage({ customType: "jira-issue", content: formatIssueSummary(issue), display: true });
        }
      } catch (error) {
        if (ctx.hasUI) ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });

  pi.registerCommand("jira-plan", {
    description: "Fetch a Jira issue and ask the agent for an implementation plan",
    handler: async (args, ctx) => {
      const { issueKey } = resolveCommandIssueKey(args);
      if (!issueKey) {
        if (ctx.hasUI) ctx.ui.notify(usageWithFocusedIssue("jira-plan"), "warning");
        return;
      }

      try {
        const issue = await fetchCompactIssue(issueKey, ctx.signal);
        if (ctx.hasUI) ctx.ui.notify(`Generating implementation plan for ${issue.key}`, "info");
        pi.sendUserMessage(buildImplementationPlanPrompt(issue));
      } catch (error) {
        if (ctx.hasUI) ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });

  pi.registerCommand("jira-fix", {
    description: "Fetch a Jira issue and ask the agent for a bug-fix/debugging plan",
    handler: async (args, ctx) => {
      const { issueKey } = resolveCommandIssueKey(args);
      if (!issueKey) {
        if (ctx.hasUI) ctx.ui.notify(usageWithFocusedIssue("jira-fix"), "warning");
        return;
      }

      try {
        const issue = await fetchCompactIssue(issueKey, ctx.signal);
        if (ctx.hasUI) ctx.ui.notify(`Generating bug-fix plan for ${issue.key}`, "info");
        pi.sendUserMessage(buildFixPlanPrompt(issue));
      } catch (error) {
        if (ctx.hasUI) ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });
}
