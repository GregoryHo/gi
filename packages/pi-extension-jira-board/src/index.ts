import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { getBoardSnapshot } from "./board-snapshot.ts";
import { JiraConfigError, loadJiraConfig } from "./config.ts";
import { registerJiraClearCommand } from "./jira-clear.ts";
import { cockpitStateFromContext, renderJiraCockpitWidget } from "./jira-cockpit.ts";
import { applyJiraRuntimeContext, getJiraCurrentContext, restoreJiraRuntimeContextFromEntries } from "./jira-context.ts";
import { registerJiraAutocomplete } from "./jira-autocomplete.ts";
import { registerJiraBoardCommands } from "./jira-boards.ts";
import { registerJiraBrowserCommands } from "./jira-browser.ts";
import { registerJiraCommands } from "./jira-commands.ts";
import { validateJiraConnectivity } from "./jira-client.ts";
import { registerJiraOnboardingCommand } from "./jira-onboarding.ts";
import { registerJiraTools } from "./jira-tools.ts";
import { registerJiraWriteCommands } from "./jira-writes.ts";

const PACKAGE_NAME = "jira-board";

export default function jiraBoardExtension(pi: ExtensionAPI): void {
  registerJiraTools(pi);
  registerJiraCommands(pi, PACKAGE_NAME);
  registerJiraWriteCommands(pi);
  registerJiraAutocomplete(pi);
  registerJiraOnboardingCommand(pi);
  registerJiraBrowserCommands(pi, PACKAGE_NAME);
  registerJiraBoardCommands(pi, PACKAGE_NAME);
  registerJiraClearCommand(pi, PACKAGE_NAME);

  pi.on("session_start", (_event, ctx) => {
    restoreJiraRuntimeContextFromEntries(ctx.sessionManager.getBranch());
  });

  pi.registerCommand("jira", {
    description: "Show the current Jira cockpit widget",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      try {
        const config = applyJiraRuntimeContext(loadJiraConfig());
        ctx.ui.setWidget(PACKAGE_NAME, renderJiraCockpitWidget(cockpitStateFromContext(getJiraCurrentContext(config)), "compact"));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.setWidget(PACKAGE_NAME, renderJiraCockpitWidget({ status: { kind: "error", message } }, "compact"));
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
          ctx.ui.setWidget(PACKAGE_NAME, lines);
          ctx.ui.notify("Jira board snapshot refreshed", "info");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (ctx.hasUI) {
          ctx.ui.setWidget(PACKAGE_NAME, renderJiraCockpitWidget({ status: { kind: "error", message } }, "compact"));
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
          ctx.ui.setWidget(PACKAGE_NAME, lines);
          ctx.ui.notify("Jira connectivity check passed", "info");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const lines = renderJiraCockpitWidget({ status: { kind: "error", message } }, "compact");

        if (ctx.hasUI) {
          ctx.ui.setWidget(PACKAGE_NAME, lines);
          ctx.ui.notify(message, error instanceof JiraConfigError ? "warning" : "error");
        }
      }
    },
  });
}
