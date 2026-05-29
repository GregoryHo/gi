import { mkdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export function getDefaultArtifactRoot(): string {
  return join(homedir(), ".pi", "agent", "agent-workers");
}

export function getRunLogPath(artifactRoot: string, runId: string): string {
  return join(artifactRoot, "runs", runId, "output.log");
}

export async function ensureLogDirectory(logPath: string): Promise<void> {
  await mkdir(dirname(logPath), { recursive: true, mode: 0o700 });
}

export async function readLogTail(logPath: string, maxLines = 40): Promise<string> {
  const content = await readFile(logPath, "utf8");
  const lines = content.trimEnd().split(/\r?\n/);
  return lines.slice(-maxLines).join("\n");
}
