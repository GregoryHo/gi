import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ReviewCaptureToolParams, ToolTextResult } from "./tool-types.ts";

export interface ReviewCaptureToolDetails extends Record<string, unknown> {
  action: string;
  slashCommand?: string;
  queued: boolean;
  localReviewViewer: {
    buildCommand: string;
    buildScriptPath: string;
    sotPath: string;
    runsDir: string;
    reportPath: string;
    reviewPath: string;
  };
}

const DEFAULT_ARTIFACT_DIR = ".pi-api-audit-runs";
const PACKAGE_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const BUILD_VIEWER_SCRIPT_PATH = join(PACKAGE_ROOT, "tools", "build-viewer.py");

export function executeReviewCaptureTool(
  params: ReviewCaptureToolParams,
): ToolTextResult<ReviewCaptureToolDetails> {
  const action = params.action ?? "review-viewer-guidance";
  const slashCommand = buildReviewSlashCommand(action, params);
  const artifactDir = params.artifactDir ?? DEFAULT_ARTIFACT_DIR;
  const sotPath = params.scenarioDictionaryPath ?? `${artifactDir}/scenarios.local.json`;
  const localReviewViewer = {
    buildCommand: `python3 ${shellQuote(BUILD_VIEWER_SCRIPT_PATH)} --sot ${shellQuote(sotPath)} --runs-dir ${shellQuote(artifactDir)}`,
    buildScriptPath: BUILD_VIEWER_SCRIPT_PATH,
    sotPath,
    runsDir: artifactDir,
    reportPath: `${artifactDir}/index.html`,
    reviewPath: `${artifactDir}/review.html`,
  };

  return {
    content: [
      {
        type: "text",
        text: [
          "API audit capture review helper.",
          ...(slashCommand ? [`Slash command: ${slashCommand}`] : ["No slash command is required for viewer guidance only."]),
          params.queueCommand && slashCommand ? "Slash command queued for pi follow-up execution." : "Set queueCommand=true to ask pi to run the slash command as a follow-up.",
          "Local review viewer for human review:",
          `  build: ${localReviewViewer.buildCommand}`,
          `  report: ${localReviewViewer.reportPath}`,
          `  review: ${localReviewViewer.reviewPath}`,
          "Scenario dictionary SOT is not modified automatically; apply accepted review output through normal file/code review.",
        ].join("\n"),
      },
    ],
    details: {
      action,
      ...(slashCommand ? { slashCommand } : {}),
      queued: Boolean(params.queueCommand && slashCommand),
      localReviewViewer,
    },
  };
}

function buildReviewSlashCommand(action: string, params: ReviewCaptureToolParams): string | undefined {
  if (action === "review-viewer-guidance") return undefined;
  if (action === "analyze-comparison") {
    const comparisonPath = requiredParam(params.comparisonPath, "comparisonPath", action);
    return joinCommand([
      "/api-discovery-analyze",
      "--comparison", comparisonPath,
      ...optionalFlag("--artifact-dir", params.artifactDir),
      ...optionalFlag("--scenario-dictionary", params.scenarioDictionaryPath),
    ]);
  }
  if (action === "suggest-scenario") {
    const analysisPath = requiredParam(params.analysisPath, "analysisPath", action);
    return joinCommand([
      "/api-discovery-suggest",
      "--analysis", analysisPath,
      ...optionalFlag("--artifact-dir", params.artifactDir),
      ...optionalFlag("--scenario-dictionary", params.scenarioDictionaryPath),
    ]);
  }
  if (action === "validate-suggestion") {
    const suggestionPath = requiredParam(params.suggestionPath, "suggestionPath", action);
    return joinCommand([
      "/api-discovery-validate-suggestion",
      "--suggestion", suggestionPath,
      ...optionalFlag("--scenario-dictionary", params.scenarioDictionaryPath),
    ]);
  }
  throw new Error(`Unknown review action: ${action}`);
}

function requiredParam(value: string | undefined, name: string, action: string): string {
  if (!value) throw new Error(`${name} is required for review action ${action}`);
  return value;
}

function optionalFlag(flag: string, value: string | undefined): string[] {
  return value ? [flag, value] : [];
}

function joinCommand(parts: string[]): string {
  return parts.join(" ");
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}
