import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { registerJiraClearCommand } from "./jira-clear.ts";
import { registerJiraAutocomplete } from "./jira-autocomplete.ts";
import { registerJiraBoardCommands } from "./jira-boards.ts";
import { registerJiraBrowserCommands } from "./jira-browser.ts";
import { registerJiraCommands } from "./jira-commands.ts";
import { registerJiraOnboardingCommand } from "./jira-onboarding.ts";
import { registerJiraRuntimeCommands } from "./jira-runtime.ts";
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
  registerJiraRuntimeCommands(pi, PACKAGE_NAME);
}
