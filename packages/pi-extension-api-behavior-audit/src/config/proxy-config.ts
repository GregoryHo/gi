import type { ApiSide } from "../types.ts";

export class ProxyConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProxyConfigError";
  }
}

export interface RecordingProxyConfig {
  command: "proxy";
  side: ApiSide;
  listenHost: string;
  listenPort: number;
  targetBaseUrl: string;
  artifactDir: string;
  scenarioId: string;
  allowedHosts: string[];
}

const DEFAULT_ARTIFACT_DIR = ".pi-api-audit-runs";
const DEFAULT_SCENARIO_ID = "recording-proxy-spike";

export function parseRecordingProxyArgs(args: string): RecordingProxyConfig {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  const command = tokens.shift();
  if (command !== "proxy") {
    throw new ProxyConfigError("Unknown proxy command. Expected: proxy");
  }

  const flags = parseFlags(tokens);
  const side = stringFlag(flags, "side");
  if (side !== "old" && side !== "new") {
    throw new ProxyConfigError("--side must be old or new");
  }

  const listenPort = Number(stringFlag(flags, "listen-port"));
  if (!Number.isInteger(listenPort) || listenPort < 1 || listenPort > 65535) {
    throw new ProxyConfigError("--listen-port must be an integer from 1 to 65535");
  }

  const targetBaseUrl = normalizeTargetUrl(flags["target-url"]);
  const allowedHosts = toArray(flags["allow-host"]);
  if (!isAllowedProxyTarget(targetBaseUrl, allowedHosts)) {
    throw new ProxyConfigError("Target URL must be local or explicitly allowed with --allow-host.");
  }

  return {
    command: "proxy",
    side,
    listenHost: "127.0.0.1",
    listenPort,
    targetBaseUrl,
    artifactDir: stringFlag(flags, "artifact-dir", DEFAULT_ARTIFACT_DIR),
    scenarioId: stringFlag(flags, "scenario-id", DEFAULT_SCENARIO_ID),
    allowedHosts,
  };
}

export function isAllowedProxyTarget(targetBaseUrl: string, allowedHosts: string[]): boolean {
  try {
    const url = new URL(targetBaseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]") return true;
    return allowedHosts.includes(url.hostname);
  } catch {
    return false;
  }
}

function parseFlags(tokens: string[]): Record<string, string | string[]> {
  const flags: Record<string, string | string[]> = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) throw new ProxyConfigError(`Unexpected argument: ${token}`);

    const name = token.slice(2);
    const value = tokens[index + 1];
    if (!value || value.startsWith("--")) throw new ProxyConfigError(`Missing value for --${name}`);

    if (name === "allow-host") {
      flags[name] = [...toArray(flags[name]), value];
    } else {
      flags[name] = value;
    }
    index += 1;
  }
  return flags;
}

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function stringFlag(flags: Record<string, string | string[]>, key: string, fallback?: string): string {
  const value = flags[key];
  if (value === undefined) {
    if (fallback !== undefined) return fallback;
    throw new ProxyConfigError(`--${key} is required`);
  }
  if (Array.isArray(value)) throw new ProxyConfigError(`--${key} must be provided once`);
  return value;
}

function normalizeTargetUrl(value: string | string[] | undefined): string {
  if (typeof value !== "string") throw new ProxyConfigError("--target-url is required");
  const url = new URL(value);
  return url.toString().replace(/\/+$/, "");
}
