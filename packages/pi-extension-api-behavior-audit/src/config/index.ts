export class ApiAuditConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiAuditConfigError";
  }
}

export interface AccountActivityCaptureConfig {
  command: "account-activity";
  oldBaseUrl: string;
  newBaseUrl: string;
  artifactDir: string;
  manifestPath?: string;
}

const DEFAULT_ARTIFACT_DIR = ".pi-api-audit-runs";

export function isLocalHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  } catch {
    return false;
  }
}

export function parseAccountActivityCaptureArgs(
  args: string,
  env: NodeJS.ProcessEnv = process.env,
): AccountActivityCaptureConfig {
  const tokens = splitArgs(args);
  const command = tokens.shift() ?? "";
  if (command !== "account-activity") {
    throw new ApiAuditConfigError("Unknown /api-audit command. Supported: account-activity");
  }

  const flags = parseFlags(tokens);
  const oldBaseUrl = flags["old-url"] ?? env.API_AUDIT_OLD_BASE_URL ?? "http://localhost:8080";
  const newBaseUrl = flags["new-url"] ?? env.API_AUDIT_NEW_BASE_URL ?? "http://localhost:8008";
  const artifactDir = flags["artifact-dir"] ?? env.API_AUDIT_ARTIFACT_DIR ?? DEFAULT_ARTIFACT_DIR;
  const manifestPath = flags.manifest ?? env.API_AUDIT_SCENARIO_MANIFEST;

  if (!isLocalHttpUrl(oldBaseUrl) || !isLocalHttpUrl(newBaseUrl)) {
    throw new ApiAuditConfigError("Only local old/new base URLs are allowed for M2 Layer A capture.");
  }

  return {
    command: "account-activity",
    oldBaseUrl: trimTrailingSlash(oldBaseUrl),
    newBaseUrl: trimTrailingSlash(newBaseUrl),
    artifactDir,
    ...(manifestPath ? { manifestPath } : {}),
  };
}

function splitArgs(args: string): string[] {
  return args.trim().split(/\s+/).filter(Boolean);
}

function parseFlags(tokens: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) {
      throw new ApiAuditConfigError(`Unexpected argument: ${token}`);
    }

    const name = token.slice(2);
    const value = tokens[index + 1];
    if (!value || value.startsWith("--")) {
      throw new ApiAuditConfigError(`Missing value for --${name}`);
    }

    flags[name] = value;
    index += 1;
  }
  return flags;
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}
