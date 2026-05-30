import { execFile } from "node:child_process";
import { isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const DEFAULT_ARTIFACT_DIR = ".pi-api-audit-runs";
export const DEFAULT_WORKSPACE_SCENARIO_DICTIONARY_PATH = `${DEFAULT_ARTIFACT_DIR}/scenarios.local.json`;

export interface WorkspacePathContext {
  cwd: string;
  workspaceRoot: string;
  gitRoot?: string;
}

export interface CreateWorkspacePathContextOptions {
  discoverGitRoot?: (cwd: string) => Promise<string | undefined>;
}

export async function createWorkspacePathContext(
  cwd = process.cwd(),
  options: CreateWorkspacePathContextOptions = {},
): Promise<WorkspacePathContext> {
  const normalizedCwd = resolve(cwd);
  const discoverGitRoot = options.discoverGitRoot ?? discoverGitRootFromGit;
  const gitRoot = await discoverGitRoot(normalizedCwd);
  const normalizedGitRoot = gitRoot ? resolve(gitRoot) : undefined;
  return {
    cwd: normalizedCwd,
    workspaceRoot: normalizedGitRoot ?? normalizedCwd,
    ...(normalizedGitRoot ? { gitRoot: normalizedGitRoot } : {}),
  };
}

export function resolveWorkspacePath(context: WorkspacePathContext, path: string): string {
  return isAbsolute(path) ? path : join(context.workspaceRoot, path);
}

async function discoverGitRootFromGit(cwd: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], { timeout: 5_000 });
    const value = stdout.trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}
