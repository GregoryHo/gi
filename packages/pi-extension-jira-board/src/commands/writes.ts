import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { loadJiraConfig } from "../config/index.ts";
import { resolveCommandIssueKey, parseCommandIssueKey, usageWithFocusedIssue } from "../core/command-issue.ts";
import { jiraApiFetch } from "../adapters/client.ts";
import type { JiraTransition, JiraTransitionsResult } from "../types.ts";

export function parseWriteIssueKey(args: string): string | undefined {
  return parseCommandIssueKey(args);
}

export function buildAddCommentPath(issueKey: string): string {
  return `/issue/${encodeURIComponent(issueKey)}/comment`;
}

export function buildAddCommentBody(comment: string): string {
  return JSON.stringify({ body: comment });
}

export function buildTransitionsPath(issueKey: string): string {
  return `/issue/${encodeURIComponent(issueKey)}/transitions`;
}

export function buildTransitionIssuePath(issueKey: string): string {
  return `/issue/${encodeURIComponent(issueKey)}/transitions`;
}

export function buildTransitionIssueBody(transition: JiraTransition): string {
  return JSON.stringify({ transition: { id: transition.id } });
}

export function formatCommentPreview(issueKey: string, comment: string): string {
  return `Add this comment to ${issueKey}?\n\n${comment}`;
}

export function formatTransitionPreview(issueKey: string, transition: JiraTransition): string {
  const target = transition.to?.name ? ` → ${transition.to.name}` : "";
  return `Move ${issueKey} with transition: ${transition.name}${target}?`;
}

function writeRequiresInteractive(command: string): string {
  return `/${command} requires interactive mode because Jira writes require explicit confirmation.`;
}

export function registerJiraWriteCommands(pi: ExtensionAPI): void {
  pi.registerCommand("jira-comment", {
    description: "Add a Jira comment after preview and confirmation",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify(writeRequiresInteractive("jira-comment"), "error");
        return;
      }

      const { issueKey } = resolveCommandIssueKey(args);
      if (!issueKey) {
        ctx.ui.notify(usageWithFocusedIssue("jira-comment"), "warning");
        return;
      }

      const comment = await ctx.ui.editor(`Comment for ${issueKey}:`, "");
      const body = comment?.trim();
      if (!body) {
        ctx.ui.notify("Jira comment cancelled", "info");
        return;
      }

      const confirmed = await ctx.ui.confirm("Confirm Jira comment", formatCommentPreview(issueKey, body));
      if (!confirmed) {
        ctx.ui.notify("Jira comment cancelled", "info");
        return;
      }

      try {
        const config = loadJiraConfig();
        await jiraApiFetch(config, buildAddCommentPath(issueKey), {
          method: "POST",
          body: buildAddCommentBody(body),
          signal: ctx.signal,
        });
        ctx.ui.notify(`Comment added to ${issueKey}`, "info");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });

  pi.registerCommand("jira-transition", {
    description: "Transition a Jira issue after selection, preview, and confirmation",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify(writeRequiresInteractive("jira-transition"), "error");
        return;
      }

      const { issueKey } = resolveCommandIssueKey(args);
      if (!issueKey) {
        ctx.ui.notify(usageWithFocusedIssue("jira-transition"), "warning");
        return;
      }

      try {
        const config = loadJiraConfig();
        const result = await jiraApiFetch<JiraTransitionsResult>(config, buildTransitionsPath(issueKey), {
          signal: ctx.signal,
        });
        const transitions = result.transitions;
        if (transitions.length === 0) {
          ctx.ui.notify(`No available transitions for ${issueKey}`, "warning");
          return;
        }

        const labels = transitions.map((transition, index) =>
          `${index + 1}. ${transition.name}${transition.to?.name ? ` → ${transition.to.name}` : ""}`,
        );
        const selected = await ctx.ui.select(`Transition ${issueKey}:`, labels);
        if (!selected) {
          ctx.ui.notify("Jira transition cancelled", "info");
          return;
        }

        const selectedIndex = labels.indexOf(selected);
        const transition = transitions[selectedIndex];
        if (!transition) {
          ctx.ui.notify("Selected Jira transition was not found", "error");
          return;
        }

        const confirmed = await ctx.ui.confirm("Confirm Jira transition", formatTransitionPreview(issueKey, transition));
        if (!confirmed) {
          ctx.ui.notify("Jira transition cancelled", "info");
          return;
        }

        await jiraApiFetch(config, buildTransitionIssuePath(issueKey), {
          method: "POST",
          body: buildTransitionIssueBody(transition),
          signal: ctx.signal,
        });
        ctx.ui.notify(`Transitioned ${issueKey} with ${transition.name}`, "info");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });
}
