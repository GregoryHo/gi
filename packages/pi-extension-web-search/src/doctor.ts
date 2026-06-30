import { createRequire } from "node:module";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import { resolveOpenAIAuth, type OpenAIAuth } from "./openai-search.ts";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version?: string };

const DEFAULT_TOOL_NAMES = ["web_research", "web_search", "fetch_content", "get_search_content"] as const;

interface CommandDefinition {
  description: string;
  handler(args: string, ctx: DoctorCommandContext): Promise<void>;
}

interface CommandRegistry {
  registerCommand(name: string, command: CommandDefinition): void;
}

interface DoctorCommandContext {
  mode?: string;
  ui: {
    notify(message: string, level?: "info" | "error" | "warning"): void;
  };
}

export interface DoctorReportOptions {
  version?: string;
  ctx?: ExtensionContext;
  env?: Record<string, string | undefined>;
  resolveAuth?: () => Promise<OpenAIAuth | undefined>;
  toolNames?: readonly string[];
  writeOutput?: (text: string) => void;
}

export function registerWebSearchDoctorCommand(pi: CommandRegistry, options: DoctorReportOptions = {}): void {
  pi.registerCommand("web-search-doctor", {
    description: "Diagnose Web Search extension setup and auth status.",
    async handler(_args, ctx) {
      const report = await buildDoctorReport({ ...options, ctx: options.ctx ?? (ctx as ExtensionContext) });
      if (ctx.mode === "print") {
        (options.writeOutput ?? console.log)(report);
        return;
      }
      ctx.ui.notify(report, "info");
    },
  });
}

export async function buildDoctorReport(options: DoctorReportOptions = {}): Promise<string> {
  const version = options.version ?? packageJson.version ?? "unknown";
  const env = options.env ?? process.env;
  const hasOpenAIKey = !!env.OPENAI_API_KEY?.trim();
  const toolNames = options.toolNames ?? DEFAULT_TOOL_NAMES;
  const auth = await resolveDoctorAuth(options);

  const lines = [
    "Web Search doctor",
    `Version: ${version}`,
    `Tools: ${toolNames.join(", ")}`,
    `OPENAI_API_KEY: ${hasOpenAIKey ? "present" : "absent"}`,
    auth
      ? `Search auth: available via ${auth.route}`
      : "Search auth: unavailable",
  ];

  if (auth) {
    lines.push(`Provider: ${auth.provider}`, `Model: ${auth.model}`);
  } else {
    lines.push(
      "Next steps:",
      "- Use /login to sign in with an OpenAI/Codex subscription in pi.",
      "- Set OPENAI_API_KEY in the environment before starting pi.",
    );
  }

  lines.push(
    "Safety:",
    "- Public HTTP/HTTPS fetch only.",
    "- SSRF guard: enabled.",
    "- Browser cookies: disabled.",
    "- JavaScript rendering: disabled.",
    "- Storage: session-local only.",
  );

  return lines.join("\n");
}

async function resolveDoctorAuth(options: DoctorReportOptions): Promise<OpenAIAuth | undefined> {
  try {
    return await (options.resolveAuth ?? (() => resolveOpenAIAuth(options.ctx)))();
  } catch {
    return undefined;
  }
}
