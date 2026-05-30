import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { isLocalHttpUrl } from "./index.ts";
import { isAllowedProxyTarget } from "./proxy-config.ts";

export class EnvironmentProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvironmentProfileError";
  }
}

export interface EnvironmentProfile {
  oldUrl: string;
  newUrl: string;
  oldTargetUrl: string;
  newTargetUrl: string;
  oldProxyPort?: number;
  newProxyPort?: number;
  allowHosts?: string[];
}

export interface EnvironmentProfilesConfig {
  version: 1;
  profiles: Record<string, EnvironmentProfile>;
  defaultProfile?: string;
}

export interface ResolveEnvironmentProfileInput extends Partial<EnvironmentProfile> {
  artifactDir?: string;
  profileName?: string;
}

export interface ProfileCommandResult {
  lines: string[];
  config?: EnvironmentProfilesConfig;
}

const DEFAULT_ARTIFACT_DIR = ".pi-api-audit-runs";
const DEFAULT_OLD_URL = "http://localhost:8080";
const DEFAULT_NEW_URL = "http://localhost:8008";
const CONFIG_FILE_NAME = "config.local.json";
const SENSITIVE_QUERY_KEYS = ["token", "session", "password", "passwd", "auth", "secret", "credential", "csrf"];

export function getEnvironmentProfileConfigPath(artifactDir = DEFAULT_ARTIFACT_DIR): string {
  return join(artifactDir, CONFIG_FILE_NAME);
}

export async function loadEnvironmentProfiles(artifactDir = DEFAULT_ARTIFACT_DIR): Promise<EnvironmentProfilesConfig> {
  const path = getEnvironmentProfileConfigPath(artifactDir);
  try {
    const raw = await readFile(path, "utf8");
    return validateConfig(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, profiles: {} };
    if (error instanceof EnvironmentProfileError) throw error;
    throw new EnvironmentProfileError(`Failed to load API audit environment profiles: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function saveEnvironmentProfile(
  artifactDir: string,
  profileName: string,
  profile: EnvironmentProfile,
  options: { makeDefault?: boolean } = {},
): Promise<EnvironmentProfilesConfig> {
  validateProfileName(profileName);
  const normalized = validateProfile(profile);
  const config = await loadEnvironmentProfiles(artifactDir);
  const next: EnvironmentProfilesConfig = {
    version: 1,
    profiles: { ...config.profiles, [profileName]: normalized },
    ...(options.makeDefault ? { defaultProfile: profileName } : config.defaultProfile ? { defaultProfile: config.defaultProfile } : {}),
  };
  await writeEnvironmentProfiles(artifactDir, next);
  return next;
}

export async function clearEnvironmentProfile(artifactDir: string, profileName: string): Promise<EnvironmentProfilesConfig> {
  validateProfileName(profileName);
  const config = await loadEnvironmentProfiles(artifactDir);
  const { [profileName]: _removed, ...profiles } = config.profiles;
  const next: EnvironmentProfilesConfig = {
    version: 1,
    profiles,
    ...(config.defaultProfile && config.defaultProfile !== profileName ? { defaultProfile: config.defaultProfile } : {}),
  };
  await writeEnvironmentProfiles(artifactDir, next);
  return next;
}

export async function setDefaultEnvironmentProfile(artifactDir: string, profileName: string): Promise<EnvironmentProfilesConfig> {
  validateProfileName(profileName);
  const config = await loadEnvironmentProfiles(artifactDir);
  if (!config.profiles[profileName]) throw new EnvironmentProfileError(`Environment profile not found: ${profileName}`);
  const next: EnvironmentProfilesConfig = { version: 1, profiles: config.profiles, defaultProfile: profileName };
  await writeEnvironmentProfiles(artifactDir, next);
  return next;
}

export async function resolveEnvironmentProfile(input: ResolveEnvironmentProfileInput): Promise<EnvironmentProfile> {
  const artifactDir = input.artifactDir ?? DEFAULT_ARTIFACT_DIR;
  const config = await loadEnvironmentProfiles(artifactDir);
  const profileName = input.profileName ?? config.defaultProfile;
  const stored = profileName ? config.profiles[profileName] : undefined;
  if (profileName && !stored) throw new EnvironmentProfileError(`Environment profile not found: ${profileName}`);

  const merged: Partial<EnvironmentProfile> = {
    oldUrl: DEFAULT_OLD_URL,
    newUrl: DEFAULT_NEW_URL,
    ...stored,
    ...definedOnly({
      oldUrl: input.oldUrl,
      newUrl: input.newUrl,
      oldTargetUrl: input.oldTargetUrl,
      newTargetUrl: input.newTargetUrl,
      oldProxyPort: input.oldProxyPort,
      newProxyPort: input.newProxyPort,
      allowHosts: input.allowHosts,
    }),
  };

  return validateProfile(merged);
}

export async function executeProfileCommand(args: string): Promise<ProfileCommandResult> {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  const command = tokens.shift();
  if (command !== "profile") throw new EnvironmentProfileError("Unknown profile command. Expected: profile");

  const action = tokens.shift() ?? "show";
  if (action === "show") {
    const flags = parseFlags(tokens, { booleanFlags: [] });
    const artifactDir = stringFlag(flags, "artifact-dir", DEFAULT_ARTIFACT_DIR);
    const config = await loadEnvironmentProfiles(artifactDir);
    return { lines: formatEnvironmentProfiles(config, artifactDir), config };
  }

  if (action === "save") {
    const profileName = tokens.shift();
    if (!profileName || profileName.startsWith("--")) throw new EnvironmentProfileError("profile save requires a profile name");
    const flags = parseFlags(tokens, { booleanFlags: ["default"] });
    const artifactDir = stringFlag(flags, "artifact-dir", DEFAULT_ARTIFACT_DIR);
    const config = await saveEnvironmentProfile(artifactDir, profileName, profileFromFlags(flags), {
      makeDefault: booleanFlag(flags, "default"),
    });
    return { lines: [`Saved API audit environment profile: ${profileName}`, ...formatEnvironmentProfiles(config, artifactDir)], config };
  }

  if (action === "default") {
    const profileName = tokens.shift();
    if (!profileName || profileName.startsWith("--")) throw new EnvironmentProfileError("profile default requires a profile name");
    const flags = parseFlags(tokens, { booleanFlags: [] });
    const artifactDir = stringFlag(flags, "artifact-dir", DEFAULT_ARTIFACT_DIR);
    const config = await setDefaultEnvironmentProfile(artifactDir, profileName);
    return { lines: [`Default API audit environment profile: ${profileName}`, ...formatEnvironmentProfiles(config, artifactDir)], config };
  }

  if (action === "clear") {
    const profileName = tokens.shift();
    if (!profileName || profileName.startsWith("--")) throw new EnvironmentProfileError("profile clear requires a profile name");
    const flags = parseFlags(tokens, { booleanFlags: [] });
    const artifactDir = stringFlag(flags, "artifact-dir", DEFAULT_ARTIFACT_DIR);
    const config = await clearEnvironmentProfile(artifactDir, profileName);
    return { lines: [`Cleared API audit environment profile: ${profileName}`, ...formatEnvironmentProfiles(config, artifactDir)], config };
  }

  throw new EnvironmentProfileError(`Unknown profile action: ${action}`);
}

export function formatEnvironmentProfiles(config: EnvironmentProfilesConfig, artifactDir = DEFAULT_ARTIFACT_DIR): string[] {
  const names = Object.keys(config.profiles).sort();
  if (names.length === 0) return [`API audit environment profiles: none (${getEnvironmentProfileConfigPath(artifactDir)})`];

  return [
    `API audit environment profiles (${getEnvironmentProfileConfigPath(artifactDir)}):`,
    ...names.flatMap((name) => {
      const profile = config.profiles[name];
      const suffix = config.defaultProfile === name ? " (default)" : "";
      return [
        `${name}${suffix}`,
        `  oldUrl: ${profile.oldUrl}`,
        `  newUrl: ${profile.newUrl}`,
        `  oldTargetUrl: ${profile.oldTargetUrl}`,
        `  newTargetUrl: ${profile.newTargetUrl}`,
        `  oldProxyPort: ${profile.oldProxyPort ?? "default"}`,
        `  newProxyPort: ${profile.newProxyPort ?? "default"}`,
        `  allowHosts: ${(profile.allowHosts ?? []).join(", ") || "none"}`,
      ];
    }),
  ];
}

async function writeEnvironmentProfiles(artifactDir: string, config: EnvironmentProfilesConfig): Promise<void> {
  const path = getEnvironmentProfileConfigPath(artifactDir);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(validateConfig(config), null, 2)}\n`, "utf8");
}

function profileFromFlags(flags: Record<string, string | string[] | boolean>): EnvironmentProfile {
  return validateProfile({
    oldUrl: stringFlag(flags, "old-url"),
    newUrl: stringFlag(flags, "new-url"),
    oldTargetUrl: stringFlag(flags, "old-target-url"),
    newTargetUrl: stringFlag(flags, "new-target-url"),
    oldProxyPort: optionalPortFlag(flags, "old-proxy-port"),
    newProxyPort: optionalPortFlag(flags, "new-proxy-port"),
    allowHosts: toArray(flags["allow-host"]),
  });
}

function validateConfig(value: unknown): EnvironmentProfilesConfig {
  if (!isRecord(value)) throw new EnvironmentProfileError("Environment profile config must be an object");
  if (value.version !== 1) throw new EnvironmentProfileError("Environment profile config version must be 1");
  if (!isRecord(value.profiles)) throw new EnvironmentProfileError("Environment profile config profiles must be an object");

  const profiles: Record<string, EnvironmentProfile> = {};
  for (const [name, profile] of Object.entries(value.profiles)) {
    validateProfileName(name);
    profiles[name] = validateProfile(profile);
  }

  const defaultProfile = typeof value.defaultProfile === "string" ? value.defaultProfile : undefined;
  if (defaultProfile && !profiles[defaultProfile]) {
    throw new EnvironmentProfileError(`Default environment profile not found: ${defaultProfile}`);
  }

  return { version: 1, profiles, ...(defaultProfile ? { defaultProfile } : {}) };
}

function validateProfile(value: unknown): EnvironmentProfile {
  if (!isRecord(value)) throw new EnvironmentProfileError("Environment profile must be an object");
  const allowHosts = Array.isArray(value.allowHosts) ? value.allowHosts.map(String) : [];
  const oldUrl = normalizeUrl(requiredString(value.oldUrl, "oldUrl"));
  const newUrl = normalizeUrl(requiredString(value.newUrl, "newUrl"));
  const oldTargetUrl = normalizeUrl(requiredString(value.oldTargetUrl, "oldTargetUrl"));
  const newTargetUrl = normalizeUrl(requiredString(value.newTargetUrl, "newTargetUrl"));

  for (const url of [oldUrl, newUrl, oldTargetUrl, newTargetUrl]) rejectSensitiveQuery(url);
  if (!isLocalHttpUrl(oldUrl) || !isLocalHttpUrl(newUrl)) {
    throw new EnvironmentProfileError("oldUrl and newUrl must be local http URLs.");
  }
  if (!isAllowedProxyTarget(oldTargetUrl, allowHosts) || !isAllowedProxyTarget(newTargetUrl, allowHosts)) {
    throw new EnvironmentProfileError("old/new backend target URLs must be local or explicitly allowed with allow-host.");
  }

  const oldProxyPort = optionalPort(value.oldProxyPort, "oldProxyPort");
  const newProxyPort = optionalPort(value.newProxyPort, "newProxyPort");
  if (oldProxyPort !== undefined && newProxyPort !== undefined && oldProxyPort === newProxyPort) {
    throw new EnvironmentProfileError("oldProxyPort and newProxyPort must be different.");
  }

  return {
    oldUrl,
    newUrl,
    oldTargetUrl,
    newTargetUrl,
    ...(oldProxyPort !== undefined ? { oldProxyPort } : {}),
    ...(newProxyPort !== undefined ? { newProxyPort } : {}),
    ...(allowHosts.length ? { allowHosts } : {}),
  };
}

function parseFlags(tokens: string[], options: { booleanFlags: string[] }): Record<string, string | string[] | boolean> {
  const flags: Record<string, string | string[] | boolean> = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) throw new EnvironmentProfileError(`Unexpected argument: ${token}`);
    const name = token.slice(2);
    if (options.booleanFlags.includes(name)) {
      flags[name] = true;
      continue;
    }
    const value = tokens[index + 1];
    if (!value || value.startsWith("--")) throw new EnvironmentProfileError(`Missing value for --${name}`);
    if (name === "allow-host") flags[name] = [...toArray(flags[name]), value];
    else flags[name] = value;
    index += 1;
  }
  return flags;
}

function stringFlag(flags: Record<string, string | string[] | boolean>, key: string, fallback?: string): string {
  const value = flags[key];
  if (value === undefined) {
    if (fallback !== undefined) return fallback;
    throw new EnvironmentProfileError(`--${key} is required`);
  }
  if (typeof value !== "string") throw new EnvironmentProfileError(`--${key} must be provided once`);
  return value;
}

function booleanFlag(flags: Record<string, string | string[] | boolean>, key: string): boolean {
  return flags[key] === true;
}

function optionalPortFlag(flags: Record<string, string | string[] | boolean>, key: string): number | undefined {
  const value = flags[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new EnvironmentProfileError(`--${key} must be provided once`);
  return optionalPort(Number(value), key);
}

function optionalPort(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new EnvironmentProfileError(`${name} must be an integer from 1 to 65535`);
  }
  return port;
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value) throw new EnvironmentProfileError(`${name} is required`);
  return value;
}

function normalizeUrl(value: string): string {
  return new URL(value).toString().replace(/\/+$/, "");
}

function rejectSensitiveQuery(value: string): void {
  const url = new URL(value);
  for (const key of url.searchParams.keys()) {
    const lowered = key.toLowerCase();
    if (SENSITIVE_QUERY_KEYS.some((sensitive) => lowered.includes(sensitive))) {
      throw new EnvironmentProfileError(`URL contains sensitive query parameter: ${key}`);
    }
  }
}

function validateProfileName(value: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value)) {
    throw new EnvironmentProfileError(`Invalid environment profile name: ${value}`);
  }
}

function toArray(value: string | string[] | boolean | undefined): string[] {
  if (!value || typeof value === "boolean") return [];
  return Array.isArray(value) ? value : [value];
}

function definedOnly<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
