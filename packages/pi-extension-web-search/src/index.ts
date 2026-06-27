import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { registerWebSearchDoctorCommand } from "./doctor.ts";
import { registerWebSearchTool } from "./tools.ts";

export default function webSearch(pi: ExtensionAPI): void {
  registerWebSearchTool(pi);
  registerWebSearchDoctorCommand(pi);
}
