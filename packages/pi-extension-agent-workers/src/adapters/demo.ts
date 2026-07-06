import type { ProcessWorkerAdapter } from "../core/worker-types.ts";

const DEFAULT_DURATION_MS = 250;

const DEMO_SCRIPT = `
const durationMs = Number(process.argv[1] ?? "${DEFAULT_DURATION_MS}");
const task = process.argv[2] ?? "";
console.log("agent-workers demo adapter started");
console.log("task: " + task);
setTimeout(() => {
  console.log("agent-workers demo adapter complete");
}, durationMs);
`;

export function createDemoAdapter(options: { nodePath?: string } = {}): ProcessWorkerAdapter {
  return {
    name: "demo",
    createSpawnSpec(task, cwd, runOptions = {}) {
      const durationMs = runOptions.durationMs ?? DEFAULT_DURATION_MS;
      return {
        command: options.nodePath ?? process.execPath,
        args: ["-e", DEMO_SCRIPT, String(durationMs), task],
        cwd,
        shell: false,
      };
    },
  };
}
