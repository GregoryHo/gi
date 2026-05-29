import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { getBoardSnapshot } from "./board-snapshot.ts";
import { JiraConfigError, loadJiraConfig } from "./config.ts";
import { cockpitStateFromContext, renderJiraCockpitWidget } from "./jira-cockpit.ts";
import { applyJiraRuntimeContext, getJiraCurrentContext, restoreJiraRuntimeContextFromEntries } from "./jira-context.ts";
import { validateJiraConnectivity } from "./jira-client.ts";

export function registerJiraRuntimeCommands(pi: ExtensionAPI, widgetName: string): void {
  pi.on("session_start", (_event, ctx) => {
    restoreJiraRuntimeContextFromEntries(ctx.sessionManager.getBranch());
  });

  pi.registerCommand("jira", {
    description: "Show the current Jira cockpit widget",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      try {
        const config = applyJiraRuntimeContext(loadJiraConfig());
        ctx.ui.setWidget(widgetName, renderJiraCockpitWidget(cockpitStateFromContext(getJiraCurrentContext(config)), "compact"));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.setWidget(widgetName, renderJiraCockpitWidget({ status: { kind: "error", message } }, "compact"));
      }
    },
  });

  pi.registerCommand("jira-refresh", {
    description: "Refresh the Jira board widget from read-only Jira snapshot data",
    handler: async (_args, ctx) => {
      try {
        const config = applyJiraRuntimeContext(loadJiraConfig());
        const snapshot = await getBoardSnapshot(config, { refresh: true }, ctx.signal);
        const lines = renderJiraCockpitWidget(
          cockpitStateFromContext(getJiraCurrentContext(config), {
            filter: { summary: snapshot.jql, returned: snapshot.returned, total: snapshot.total },
            status: { kind: snapshot.warnings.length > 0 ? "warning" : "ok", message: "snapshot refreshed" },
          }),
          "compact",
        );

        if (ctx.hasUI) {
          ctx.ui.setWidget(widgetName, lines);
          ctx.ui.notify("Jira board snapshot refreshed", "info");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (ctx.hasUI) {
          ctx.ui.setWidget(widgetName, renderJiraCockpitWidget({ status: { kind: "error", message } }, "compact"));
          ctx.ui.notify(message, error instanceof JiraConfigError ? "warning" : "error");
        }
      }
    },
  });

  pi.registerCommand("jira-status", {
    description: "Validate Jira extension configuration and read-only connectivity",
    handler: async (_args, ctx) => {
      try {
        const config = applyJiraRuntimeContext(loadJiraConfig());
        const connectivity = await validateJiraConnectivity(config, { signal: ctx.signal });
        const lines = renderJiraCockpitWidget(
          cockpitStateFromContext(getJiraCurrentContext(config), {
            status: { kind: "ok", message: `connected as ${connectivity.userLabel}` },
          }),
          "compact",
        );

        if (ctx.hasUI) {
          ctx.ui.setWidget(widgetName, lines);
          ctx.ui.notify("Jira connectivity check passed", "info");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const lines = renderJiraCockpitWidget({ status: { kind: "error", message } }, "compact");

        if (ctx.hasUI) {
          ctx.ui.setWidget(widgetName, lines);
          ctx.ui.notify(message, error instanceof JiraConfigError ? "warning" : "error");
        }
      }
    },
  });
}
