import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { registerJiraClearCommand } from "./commands/clear.ts";
import { registerJiraAutocomplete } from "./ui/autocomplete.ts";
import { registerJiraBoardCommands } from "./commands/boards.ts";
import { registerJiraBrowserCommands } from "./commands/browser.ts";
import { registerJiraCommands } from "./commands/index.ts";
import { registerJiraOnboardingCommand } from "./commands/onboarding.ts";
import { registerJiraRuntimeCommands } from "./commands/runtime.ts";
import { registerJiraTools } from "./tools/index.ts";
import { registerJiraWriteCommands } from "./commands/writes.ts";

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
