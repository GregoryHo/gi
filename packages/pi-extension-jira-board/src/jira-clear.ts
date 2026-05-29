import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { loadJiraConfig, type JiraConfig } from "./config.ts";
import { cockpitStateFromContext, renderJiraCockpitWidget } from "./jira-cockpit.ts";
import {
  JIRA_CONTEXT_ENTRY_TYPE,
  captureJiraRuntimeContext,
  clearJiraRuntimeContext,
  getJiraCurrentContext,
} from "./jira-context.ts";

interface JiraClearDependencies {
  loadConfig?: () => JiraConfig;
}

export function registerJiraClearCommand(
  pi: Pick<ExtensionAPI, "registerCommand" | "appendEntry">,
  widgetName: string,
  dependencies: JiraClearDependencies = {},
): void {
  const loadConfigDependency = dependencies.loadConfig ?? loadJiraConfig;

  pi.registerCommand("jira-clear", {
    description: "Clear active Jira project board filters and focused issue context",
    handler: async (_args, ctx) => {
      clearJiraRuntimeContext();
      pi.appendEntry(JIRA_CONTEXT_ENTRY_TYPE, captureJiraRuntimeContext());

      if (!ctx.hasUI) return;

      try {
        const config = loadConfigDependency();
        ctx.ui.setWidget(widgetName, renderJiraCockpitWidget(cockpitStateFromContext(getJiraCurrentContext(config)), "compact"));
      } catch {
        ctx.ui.setWidget(widgetName, renderJiraCockpitWidget(cockpitStateFromContext(getJiraCurrentContext()), "compact"));
      }
      ctx.ui.notify("Cleared Jira project/board/issue context", "info");
    },
  });
}
