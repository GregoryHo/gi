import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";

import { saveLocalJiraCredentials, type SaveLocalJiraCredentialsInput } from "../config/local.ts";
import { validateJiraConnectivity } from "../adapters/client.ts";
import type { JiraConfig } from "../config/index.ts";

export function parseOnboardingBoardId(value: string | undefined): number | undefined {
  const text = value?.trim();
  if (!text) return undefined;

  const boardId = Number(text);
  if (!Number.isInteger(boardId) || boardId <= 0) {
    throw new Error("Board ID must be a positive integer");
  }
  return boardId;
}

export function formatOnboardingPreview(input: SaveLocalJiraCredentialsInput): string {
  return [
    "Save Jira configuration?",
    "",
    `Base URL: ${normalizeBaseUrl(input.baseUrl)}`,
    `User: ${input.user.trim()}`,
    `Auth type: ${input.authType}`,
    "Secret: encrypted local storage",
    `Project: ${input.project?.trim() || "not configured"}`,
    `Board ID: ${input.boardId === undefined ? "not configured" : input.boardId}`,
  ].join("\n");
}

export function createMaskedSecretInputComponent(title: string, done: (value: string | undefined) => void): Component {
  let value = "";

  return {
    render(width: number): string[] {
      const bullets = "•".repeat(value.length);
      return [
        truncate(title, width),
        truncate(`Secret: ${bullets}`, width),
        truncate("Enter submit • Esc cancel • Backspace delete", width),
      ];
    },
    handleInput(data: string): void {
      if (data === "\r" || data === "\n") {
        done(value);
        return;
      }
      if (data === "\u001b") {
        done(undefined);
        return;
      }
      if (data === "\b" || data === "\u007f") {
        value = value.slice(0, -1);
        return;
      }
      if (isPrintable(data)) {
        value += data;
      }
    },
    invalidate(): void {},
  };
}

export function registerJiraOnboardingCommand(pi: ExtensionAPI): void {
  pi.registerCommand("jira-onboarding", {
    description: "Configure Jira connection and encrypted local credentials",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/jira-onboarding requires interactive UI", "error");
        return;
      }

      try {
        const baseUrl = await ctx.ui.input("Jira server URL", "https://jira.example.com");
        if (!baseUrl?.trim()) return;

        const user = await ctx.ui.input("Jira username or email", "jira-user");
        if (!user?.trim()) return;

        const authTypeChoice = await ctx.ui.select("Jira auth type", ["token", "password"]);
        if (authTypeChoice !== "token" && authTypeChoice !== "password") return;

        const secret = await promptMaskedSecret(ctx, `Enter Jira ${authTypeChoice}`);
        if (!secret) return;

        const project = (await ctx.ui.input("Default Jira project (optional)", "PROJ"))?.trim() || undefined;
        const boardId = parseOnboardingBoardId(await ctx.ui.input("Default Jira board ID (optional)", "123"));

        const input: SaveLocalJiraCredentialsInput = {
          baseUrl,
          user,
          authType: authTypeChoice,
          secret,
          project,
          boardId,
        };
        const config: JiraConfig = {
          baseUrl: normalizeBaseUrl(baseUrl),
          user: user.trim(),
          secret,
          project,
          boardId,
        };

        const connectivity = await validateJiraConnectivity(config, { signal: ctx.signal });
        const confirmed = await ctx.ui.confirm(
          "Save Jira config",
          `${formatOnboardingPreview(input)}\n\nConnectivity: connected as ${connectivity.userLabel}`,
        );
        if (!confirmed) return;

        await saveLocalJiraCredentials(input);
        ctx.ui.notify("Jira configuration saved", "info");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });
}

async function promptMaskedSecret(
  ctx: { ui: { custom<T>(factory: (tui: unknown, theme: unknown, keybindings: unknown, done: (result: T) => void) => Component): Promise<T> } },
  title: string,
): Promise<string | undefined> {
  return ctx.ui.custom<string | undefined>((tui, _theme, _keybindings, done) => {
    const component = createMaskedSecretInputComponent(title, done);
    return {
      ...component,
      handleInput(data: string) {
        component.handleInput?.(data);
        if (typeof tui === "object" && tui && "requestRender" in tui) {
          (tui as { requestRender(): void }).requestRender();
        }
      },
    };
  });
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function isPrintable(data: string): boolean {
  return data.length === 1 && data >= " " && data !== "\u007f";
}

function truncate(text: string, width: number): string {
  if (width <= 0 || text.length <= width) return text;
  if (width <= 1) return "…";
  return `${text.slice(0, width - 1)}…`;
}
