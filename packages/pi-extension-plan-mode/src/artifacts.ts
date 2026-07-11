import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import type { CurrentPlanPointer, PlanArtifactV1, PlanIndex, PlanIndexEntry } from "./artifact-types.ts";
import { planSummaryFromSteps } from "./artifact-types.ts";

export interface PlanIndexFilter {
  cwd?: string;
  sessionFile?: string;
}

export function getProjectKey(cwd: string): string {
  const base = sanitizePathPart(basename(cwd) || "project");
  const hash = createHash("sha1").update(cwd).digest("hex").slice(0, 8);
  return `${base}-${hash}`;
}

export function getPlanModeProjectDir(agentDir: string, cwd: string): string {
  return join(agentDir, "plan-mode", getProjectKey(cwd));
}

export function getPlanArtifactRelativePath(plan: PlanArtifactV1): string {
  return `plans/${plan.createdAt.slice(0, 7)}/${plan.id}.json`;
}

export async function readCurrentPlanPointer(root: string): Promise<CurrentPlanPointer> {
  return (await readJson<CurrentPlanPointer>(join(root, "current.json"))) ?? {};
}

export async function writeCurrentPlanPointer(root: string, pointer: CurrentPlanPointer): Promise<void> {
  await writeJson(join(root, "current.json"), pointer.activePlanId ? { activePlanId: pointer.activePlanId } : {});
}

export async function readSessionCurrentPlanPointer(root: string, sessionFile: string): Promise<CurrentPlanPointer> {
	return (await readJson<CurrentPlanPointer>(getSessionPointerPath(root, sessionFile))) ?? {};
}

export async function writeSessionCurrentPlanPointer(root: string, sessionFile: string, pointer: CurrentPlanPointer): Promise<void> {
	await writeJson(getSessionPointerPath(root, sessionFile), pointer.activePlanId ? { activePlanId: pointer.activePlanId } : {});
}

export async function writePlanArtifact(root: string, plan: PlanArtifactV1): Promise<string> {
  const relativePath = getPlanArtifactRelativePath(plan);
  await writeJson(join(root, relativePath), plan);
  await upsertPlanIndexEntry(root, toPlanIndexEntry(plan, relativePath));
  return relativePath;
}

export async function readPlanArtifact(root: string, planId: string): Promise<PlanArtifactV1 | undefined> {
  const entry = (await listPlanIndexEntries(root)).find((candidate) => candidate.id === planId);
  if (!entry) return undefined;
  return readJson<PlanArtifactV1>(join(root, entry.artifactPath));
}

export async function listPlanIndexEntries(root: string, filter: PlanIndexFilter = {}): Promise<PlanIndexEntry[]> {
  const index = await readPlanIndex(root);
  return index.plans.filter((entry) => {
    if (filter.cwd !== undefined && entry.cwd !== filter.cwd) return false;
    if (filter.sessionFile !== undefined && entry.sessionFile !== filter.sessionFile) return false;
    return true;
  });
}

export async function getNextSessionPlanNumber(root: string, sessionFile?: string): Promise<number> {
  if (!sessionFile) return (await listPlanIndexEntries(root)).length + 1;
  return (await listPlanIndexEntries(root, { sessionFile })).length + 1;
}

export async function getLatestSessionPlanId(root: string, sessionFile?: string): Promise<string | undefined> {
  const entries = await listPlanIndexEntries(root, sessionFile ? { sessionFile } : {});
  return entries.at(-1)?.id;
}

async function upsertPlanIndexEntry(root: string, entry: PlanIndexEntry): Promise<void> {
  const index = await readPlanIndex(root);
  const existingIndex = index.plans.findIndex((candidate) => candidate.id === entry.id);
  const nextPlans = existingIndex >= 0 ? [...index.plans] : [...index.plans, entry];
  if (existingIndex >= 0) nextPlans[existingIndex] = entry;
  await writeJson(join(root, "index.json"), { plans: nextPlans });
}

async function readPlanIndex(root: string): Promise<PlanIndex> {
  return (await readJson<PlanIndex>(join(root, "index.json"))) ?? { plans: [] };
}

function toPlanIndexEntry(plan: PlanArtifactV1, artifactPath: string): PlanIndexEntry {
  return {
    id: plan.id,
    title: plan.title,
    status: plan.status,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    cwd: plan.cwd,
    sessionFile: plan.session.primarySessionFile,
    sessionPlanNumber: plan.sequence.sessionPlanNumber,
    artifactPath,
    summary: plan.recap?.summary ?? planSummaryFromSteps(plan.steps),
  };
}

async function readJson<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function getSessionPointerPath(root: string, sessionFile: string): string {
	const sessionKey = createHash("sha1").update(sessionFile).digest("hex").slice(0, 16);
	return join(root, "sessions", `${sessionKey}.json`);
}

function sanitizePathPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "project";
}
