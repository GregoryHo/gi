import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import type { JiraConfig } from "./config.ts";
import {
  decryptSecret,
  encryptSecret,
  loadOrCreateMasterKey,
  readSecretStore,
  type SecretStore,
  writeSecretStore,
} from "./secret-store.ts";

const DEFAULT_SECRET_REF = "default";

export interface LocalJiraConfigFile {
  baseUrl: string;
  user: string;
  authType: "token" | "password";
  project?: string;
  boardId?: number;
  secretRef: string;
}

export interface SaveLocalJiraCredentialsInput {
  baseUrl: string;
  user: string;
  authType: "token" | "password";
  secret: string;
  project?: string;
  boardId?: number;
}

export interface LocalJiraConfigOptions {
  configDir?: string;
}

export interface LocalJiraPaths {
  configDir: string;
  configPath: string;
  secretsPath: string;
  masterKeyPath: string;
}

export function getDefaultLocalJiraConfigDir(): string {
  return join(homedir(), ".pi", "agent", "jira-board");
}

export function getLocalJiraPaths(configDir = getDefaultLocalJiraConfigDir()): LocalJiraPaths {
  return {
    configDir,
    configPath: join(configDir, "config.json"),
    secretsPath: join(configDir, "secrets.json"),
    masterKeyPath: join(configDir, "master.key"),
  };
}

export async function saveLocalJiraCredentials(
  input: SaveLocalJiraCredentialsInput,
  options: LocalJiraConfigOptions = {},
): Promise<void> {
  const paths = getLocalJiraPaths(options.configDir);
  await mkdir(paths.configDir, { recursive: true });

  const key = await loadOrCreateMasterKey(paths.masterKeyPath);
  const existingStore = await readOptionalSecretStore(paths.secretsPath);
  const secretRef = DEFAULT_SECRET_REF;
  const store: SecretStore = {
    ...existingStore,
    [secretRef]: encryptSecret(input.secret, key),
  };

  const config: LocalJiraConfigFile = {
    baseUrl: normalizeBaseUrl(input.baseUrl),
    user: input.user.trim(),
    authType: input.authType,
    ...(input.project?.trim() ? { project: input.project.trim() } : {}),
    ...(input.boardId !== undefined ? { boardId: input.boardId } : {}),
    secretRef,
  };

  await writeSecretStore(paths.secretsPath, store);
  await writeFile(paths.configPath, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

export async function readLocalJiraConfig(options: LocalJiraConfigOptions = {}): Promise<JiraConfig> {
  return readLocalJiraConfigSync(options);
}

export function readLocalJiraConfigSync(options: LocalJiraConfigOptions = {}): JiraConfig {
  const paths = getLocalJiraPaths(options.configDir);
  if (!existsSync(paths.configPath)) {
    throw new Error("Missing local Jira config. Run /jira-onboarding to configure Jira.");
  }

  const config = parseLocalConfig(readFileSync(paths.configPath, "utf8"));
  const key = readMasterKeySync(paths.masterKeyPath);
  const store = parseSecretStore(readFileSync(paths.secretsPath, "utf8"));
  const encrypted = store[config.secretRef];
  if (!encrypted) {
    throw new Error(`Missing encrypted Jira secret for ref: ${config.secretRef}`);
  }

  return {
    baseUrl: normalizeBaseUrl(config.baseUrl),
    user: config.user,
    secret: decryptSecret(encrypted, key),
    project: config.project,
    boardId: config.boardId,
  };
}

function parseLocalConfig(raw: string): LocalJiraConfigFile {
  const parsed = JSON.parse(raw) as Partial<LocalJiraConfigFile>;
  if (!parsed.baseUrl || !parsed.user || !parsed.secretRef) {
    throw new Error("Invalid local Jira config. Run /jira-onboarding to reconfigure Jira.");
  }
  if (parsed.authType !== "token" && parsed.authType !== "password") {
    throw new Error("Invalid local Jira config auth type. Run /jira-onboarding to reconfigure Jira.");
  }
  if (parsed.boardId !== undefined && (!Number.isInteger(parsed.boardId) || parsed.boardId <= 0)) {
    throw new Error("Invalid local Jira board id. Run /jira-onboarding to reconfigure Jira.");
  }

  return {
    baseUrl: parsed.baseUrl,
    user: parsed.user,
    authType: parsed.authType,
    project: parsed.project,
    boardId: parsed.boardId,
    secretRef: parsed.secretRef,
  };
}

function parseSecretStore(raw: string): SecretStore {
  return JSON.parse(raw) as SecretStore;
}

function readMasterKeySync(path: string): Buffer {
  const key = Buffer.from(readFileSync(path, "utf8").trim(), "base64");
  if (key.length !== 32) {
    throw new Error("Invalid Jira master key: expected 32 bytes");
  }
  return key;
}

async function readOptionalSecretStore(path: string): Promise<SecretStore> {
  try {
    return await readSecretStore(path);
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: unknown }).code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}
