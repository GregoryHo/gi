import type { WorkerAdapterName, WorkerMode, WorkerProfile } from "./request-types.ts";

const MAX_TIMEOUT_MS = 24 * 60 * 60 * 1000;

const BUILT_IN_PROFILES: WorkerProfile[] = [
  {
    name: "planner",
    description: "Read-only planning worker for breaking down tasks before implementation.",
    adapter: "claude-code",
    mode: "plan",
    systemPrompt: [
      "You are a planning worker.",
      "Analyze the task and produce a concise implementation or investigation plan.",
      "Do not modify files.",
      "Call out assumptions, risks, and verification steps.",
    ].join(" "),
    requireConfirmation: true,
    readOnly: true,
    canModifyWorkspace: false,
    recommendedUse: "Use for read-only planning, decomposition, and implementation strategy before code changes.",
  },
  {
    name: "reviewer",
    description: "Read-only review worker for finding issues in a change, plan, or diff.",
    adapter: "claude-code",
    mode: "review",
    systemPrompt: [
      "You are a review worker.",
      "Inspect the provided task, plan, or change and report findings with severity and evidence.",
      "Do not modify files.",
      "Focus on correctness, safety, regressions, and missing tests.",
    ].join(" "),
    requireConfirmation: true,
    readOnly: true,
    canModifyWorkspace: false,
    recommendedUse: "Use for independent read-only review of proposed or completed changes.",
  },
  {
    name: "implementer",
    description: "Focused code-change worker for small, bounded implementation tasks.",
    adapter: "claude-code",
    mode: "implement",
    systemPrompt: [
      "You are an implementation worker.",
      "Make the smallest focused code change that satisfies the requested task.",
      "Prefer minimal diffs and no unrelated refactors, formatting churn, or speculative abstractions.",
      "Do not add unsafe permission flags or bypass normal tool safety.",
      "Preserve existing style and remove only dead code introduced by your own change.",
      "Run or recommend explicit verification, and summarize changed files and verification results.",
    ].join(" "),
    requireConfirmation: true,
    readOnly: false,
    canModifyWorkspace: true,
    recommendedUse: "Use for focused implementation after scope and workspace are clear; requires explicit confirmation for real workers.",
  },
  {
    name: "verifier",
    description: "Read-only verification worker for checking whether acceptance criteria are satisfied.",
    adapter: "claude-code",
    mode: "review",
    systemPrompt: [
      "You are a verification worker.",
      "Do not modify files.",
      "Independently verify the implementation against the stated acceptance criteria, diffs, tests, and likely regressions.",
      "Report pass, fail, or gaps with concrete evidence.",
      "Identify missing verification evidence and the smallest follow-up checks needed.",
    ].join(" "),
    requireConfirmation: true,
    readOnly: true,
    canModifyWorkspace: false,
    recommendedUse: "Use for independent verification after implementation, especially before marking a milestone complete.",
  },
];

const BUILT_IN_PROFILE_NAMES = new Set(BUILT_IN_PROFILES.map((profile) => profile.name));

export function getBuiltInWorkerProfiles(): WorkerProfile[] {
  return BUILT_IN_PROFILES.map(copyProfile);
}

export function getWorkerProfiles(customProfiles: WorkerProfile[] = []): WorkerProfile[] {
  return [...getBuiltInWorkerProfiles(), ...validateCustomWorkerProfiles(customProfiles)];
}

export function resolveWorkerProfile(name: string, customProfiles: WorkerProfile[] = []): WorkerProfile {
  const profiles = getWorkerProfiles(customProfiles);
  const profile = profiles.find((candidate) => candidate.name === name);
  if (!profile) {
    const available = profiles.map((candidate) => candidate.name).join(", ");
    throw new Error(`Unknown worker profile: ${name}. Available profiles: ${available}.`);
  }
  return copyProfile(profile);
}

export function validateCustomWorkerProfiles(rawProfiles: unknown): WorkerProfile[] {
  if (rawProfiles === undefined) return [];
  if (!Array.isArray(rawProfiles)) throw new Error("profiles must be an array.");
  const seen = new Set<string>();
  return rawProfiles.map((raw, index) => validateCustomWorkerProfile(raw, index, seen));
}

function validateCustomWorkerProfile(raw: unknown, index: number, seen: Set<string>): WorkerProfile {
  if (!raw || typeof raw !== "object") throw new Error(`profiles[${index}] must be an object.`);
  const input = raw as Partial<WorkerProfile>;
  const name = nonEmptyString(input.name, `profiles[${index}].name`);
  if (BUILT_IN_PROFILE_NAMES.has(name)) throw new Error(`Custom profile cannot override built-in profile: ${name}.`);
  if (seen.has(name)) throw new Error(`Duplicate custom profile: ${name}.`);
  seen.add(name);

  const adapter = validateAdapter(input.adapter, `profiles[${index}].adapter`);
  const requireConfirmation = validateBoolean(input.requireConfirmation, `profiles[${index}].requireConfirmation`);
  if (isRealAdapter(adapter) && requireConfirmation === false) {
    throw new Error(`Custom profile ${name} must require confirmation for real adapter ${adapter}.`);
  }

  return {
    name,
    description: nonEmptyString(input.description, `profiles[${index}].description`),
    adapter,
    mode: validateMode(input.mode, `profiles[${index}].mode`),
    ...(input.systemPrompt === undefined ? {} : { systemPrompt: nonEmptyString(input.systemPrompt, `profiles[${index}].systemPrompt`) }),
    ...(input.model === undefined ? {} : { model: nonEmptyString(input.model, `profiles[${index}].model`) }),
    requireConfirmation,
    readOnly: validateBoolean(input.readOnly, `profiles[${index}].readOnly`),
    canModifyWorkspace: validateBoolean(input.canModifyWorkspace, `profiles[${index}].canModifyWorkspace`),
    recommendedUse: nonEmptyString(input.recommendedUse, `profiles[${index}].recommendedUse`),
    ...(input.defaultTimeoutMs === undefined ? {} : { defaultTimeoutMs: validateTimeout(input.defaultTimeoutMs, `profiles[${index}].defaultTimeoutMs`) }),
  };
}

function copyProfile(profile: WorkerProfile): WorkerProfile {
  return { ...profile };
}

function nonEmptyString(value: unknown, key: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${key} must be a non-empty string.`);
  return value.trim();
}

function validateBoolean(value: unknown, key: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${key} must be a boolean.`);
  return value;
}

function validateAdapter(value: unknown, key: string): WorkerAdapterName {
  if (value === "demo" || value === "claude-code" || value === "codex-cli") return value;
  throw new Error(`${key} must be one of: demo, claude-code, codex-cli.`);
}

function validateMode(value: unknown, key: string): WorkerMode {
  if (value === "plan" || value === "review" || value === "implement" || value === "custom") return value;
  throw new Error(`${key} must be one of: plan, review, implement, custom.`);
}

function validateTimeout(value: unknown, key: string): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > MAX_TIMEOUT_MS) {
    throw new Error(`${key} must be between 1 and ${MAX_TIMEOUT_MS}.`);
  }
  return value as number;
}

function isRealAdapter(adapter: WorkerAdapterName): boolean {
  return adapter === "claude-code" || adapter === "codex-cli";
}
