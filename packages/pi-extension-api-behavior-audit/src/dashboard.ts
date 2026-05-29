import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { getEnvironmentProfileConfigPath } from "./environment-profiles.ts";
import { loadScenarioDictionary } from "./scenario-dictionary.ts";

export interface ApiAuditDashboardOptions {
  artifactDir?: string;
  maxRecentRuns?: number;
}

interface ProfileSummary {
  names: string[];
  defaultProfile?: string;
}

interface RunSummary {
  runId: string;
  layer?: string;
  scenarios: string[];
  exchangeCount?: number;
}

const DEFAULT_ARTIFACT_DIR = ".pi-api-audit-runs";

export async function buildApiAuditDashboardLines(options: ApiAuditDashboardOptions = {}): Promise<string[]> {
  const artifactDir = options.artifactDir ?? DEFAULT_ARTIFACT_DIR;
  const [profiles, scenarioIds, recentRuns] = await Promise.all([
    loadProfileSummary(artifactDir),
    loadScenarioIds(artifactDir),
    loadRecentRuns(artifactDir, options.maxRecentRuns ?? 3),
  ]);
  const defaultScenario = scenarioIds[0] ?? "<scenario-id>";
  const defaultProfile = profiles.defaultProfile ?? profiles.names[0];

  return [
    "API audit dashboard",
    `Artifact dir: ${artifactDir}`,
    profiles.names.length
      ? `Profiles: ${profiles.names.map((name) => `${name}${profiles.defaultProfile === name ? " (default)" : ""}`).join(", ")}`
      : "Profiles: none",
    scenarioIds.length ? `Scenarios: ${scenarioIds.join(", ")}` : "Scenarios: none",
    recentRuns.length
      ? "Recent runs:"
      : "Recent runs: none",
    ...recentRuns.map(
      (run) =>
        `  ${run.runId} ${run.layer ?? "unknown"} scenarios=${run.scenarios.join(",") || "none"} exchanges=${run.exchangeCount ?? "unknown"}`,
    ),
    "Actions:",
    "  /api-audit setup",
    "  /api-audit profile show",
    defaultProfile
      ? `  /api-audit capture --scenario-id ${defaultScenario} --profile ${defaultProfile}`
      : `  /api-audit capture --scenario-id ${defaultScenario} --profile <name>`,
    defaultProfile
      ? `  /api-audit capture --run --scenario-id ${defaultScenario} --profile ${defaultProfile}`
      : `  /api-audit capture --run --scenario-id ${defaultScenario} --profile <name>`,
  ];
}

async function loadProfileSummary(artifactDir: string): Promise<ProfileSummary> {
  try {
    const raw = await readFile(getEnvironmentProfileConfigPath(artifactDir), "utf8");
    const parsed = JSON.parse(raw) as { profiles?: unknown; defaultProfile?: unknown };
    const profiles = parsed.profiles && typeof parsed.profiles === "object" ? Object.keys(parsed.profiles).sort() : [];
    const defaultProfile = typeof parsed.defaultProfile === "string" ? parsed.defaultProfile : undefined;
    return { names: profiles, ...(defaultProfile ? { defaultProfile } : {}) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { names: [] };
    return { names: [] };
  }
}

async function loadScenarioIds(artifactDir: string): Promise<string[]> {
  try {
    const dictionary = await loadScenarioDictionary(join(artifactDir, "scenarios.local.json"));
    return dictionary.scenarios.map((scenario) => scenario.id);
  } catch {
    return [];
  }
}

async function loadRecentRuns(artifactDir: string, maxRuns: number): Promise<RunSummary[]> {
  let entries: string[];
  try {
    entries = await readdir(artifactDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const runs: RunSummary[] = [];
  for (const entry of entries.sort().reverse()) {
    if (runs.length >= maxRuns) break;
    try {
      const raw = await readFile(join(artifactDir, entry, "manifest.json"), "utf8");
      const manifest = JSON.parse(raw) as { runId?: unknown; layer?: unknown; scenarios?: unknown; exchangeCount?: unknown };
      runs.push({
        runId: typeof manifest.runId === "string" ? manifest.runId : entry,
        ...(typeof manifest.layer === "string" ? { layer: manifest.layer } : {}),
        scenarios: Array.isArray(manifest.scenarios) ? manifest.scenarios.map(String) : [],
        ...(typeof manifest.exchangeCount === "number" ? { exchangeCount: manifest.exchangeCount } : {}),
      });
    } catch {
      // Ignore non-run directories and malformed local scratch files in the artifact dir.
    }
  }
  return runs;
}
