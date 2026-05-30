import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

export interface WorkspaceCandidate {
  path: string;
  label: string;
  source: "current" | "git-root" | "sibling-git";
}

export interface WorkspaceValidationResult {
  cwd: string;
  errors: string[];
  warnings: string[];
  gitRoot?: string;
}

export interface WorkspaceScope {
  scopeKey: string;
  scopeLabel: string;
  cwd: string;
  gitRoot?: string;
}

export function resolveWorkerCwd(explicitCwd: string | undefined, currentCwd: string | undefined): string {
  return normalizeWorkspacePath(explicitCwd ?? currentCwd ?? process.cwd());
}

export function normalizeWorkspacePath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) return process.cwd();
  return isAbsolute(trimmed) ? resolve(trimmed) : resolve(process.cwd(), trimmed);
}

export function resolveWorkspaceScope(cwd: string): WorkspaceScope {
  const validation = validateWorkerWorkspace(cwd);
  const scopeKey = validation.gitRoot ?? validation.cwd;
  return {
    scopeKey,
    scopeLabel: basename(scopeKey) || scopeKey,
    cwd: validation.cwd,
    ...(validation.gitRoot ? { gitRoot: validation.gitRoot } : {}),
  };
}

export function validateWorkerWorkspace(cwd: string, options: { task?: string } = {}): WorkspaceValidationResult {
  const normalized = normalizeWorkspacePath(cwd);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!existsSync(normalized)) {
    return { cwd: normalized, errors: [`Workspace path does not exist: ${normalized}`], warnings };
  }

  const stat = statSync(normalized);
  if (!stat.isDirectory()) {
    return { cwd: normalized, errors: [`Workspace path is not a directory: ${normalized}`], warnings };
  }

  const gitRoot = findGitRoot(normalized);
  if (!gitRoot) warnings.push(`Workspace is not inside a git repository: ${normalized}`);

  if (looksLikeProductTask(options.task) && looksLikeAgentWorkersRepo(normalized, gitRoot)) {
    warnings.push(
      "Workspace appears to be the agent-workers extension repo; confirm this is the intended product repository for the task.",
    );
  }

  return { cwd: normalized, errors, warnings, ...(gitRoot ? { gitRoot } : {}) };
}

export function discoverWorkspaceCandidates(options: {
  currentCwd: string;
  maxCandidates?: number;
}): WorkspaceCandidate[] {
  const maxCandidates = Math.max(1, options.maxCandidates ?? 12);
  const candidates: WorkspaceCandidate[] = [];
  const addCandidate = (candidate: WorkspaceCandidate) => {
    const normalized = normalizeWorkspacePath(candidate.path);
    if (!existsSync(normalized)) return;
    if (candidates.some((existing) => existing.path === normalized)) return;
    candidates.push({ ...candidate, path: normalized });
  };

  const current = normalizeWorkspacePath(options.currentCwd);
  addCandidate({ path: current, label: `current: ${current}`, source: "current" });

  const gitRoot = findGitRoot(current);
  if (gitRoot) addCandidate({ path: gitRoot, label: `git root: ${gitRoot}`, source: "git-root" });

  const siblingBase = gitRoot ? dirname(gitRoot) : dirname(current);
  for (const sibling of listSiblingGitRepos(siblingBase).sort()) {
    addCandidate({ path: sibling, label: `sibling git repo: ${sibling}`, source: "sibling-git" });
    if (candidates.length >= maxCandidates) break;
  }

  return candidates.slice(0, maxCandidates);
}

export function formatWorkspaceStatusLines(currentCwd: string): string[] {
  const current = normalizeWorkspacePath(currentCwd);
  const validation = validateWorkerWorkspace(current);
  const lines = [
    "Agent worker workspace",
    `current: ${current}`,
    `gitRoot: ${validation.gitRoot ?? "none"}`,
  ];
  if (validation.warnings.length > 0) lines.push(...validation.warnings.map((warning) => `warning: ${warning}`));
  lines.push("Default worker cwd is the current pi cwd. Use /worker-run --cwd <path> ... or /worker-run --pick-cwd ... for one run.");
  return lines;
}

export function formatWorkspacePreflightLines(validation: WorkspaceValidationResult): string[] {
  const lines = [`workspace: ${validation.cwd}`];
  if (validation.gitRoot) lines.push(`gitRoot: ${validation.gitRoot}`);
  for (const warning of validation.warnings) lines.push(`warning: ${warning}`);
  return lines;
}

function findGitRoot(startPath: string): string | undefined {
  let current = normalizeWorkspacePath(startPath);
  while (true) {
    if (existsSync(join(current, ".git"))) return current;
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function listSiblingGitRepos(parent: string): string[] {
  try {
    return readdirSync(parent, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(parent, entry.name))
      .filter((path) => existsSync(join(path, ".git")));
  } catch {
    return [];
  }
}

function looksLikeProductTask(task: string | undefined): boolean {
  if (!task) return false;
  return /jira|WIN-\d+|issue|bug|wingo|pps|product|implementation|implement|fix/i.test(task);
}

function looksLikeAgentWorkersRepo(cwd: string, gitRoot: string | undefined): boolean {
  return /gi-agent-workers$/.test(cwd) || (gitRoot !== undefined && /gi-agent-workers$/.test(gitRoot));
}
