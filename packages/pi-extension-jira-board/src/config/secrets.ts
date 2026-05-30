import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;

export interface EncryptedSecret {
  algorithm: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

export type SecretStore = Record<string, EncryptedSecret>;

export function encryptSecret(secret: string, key: Buffer): EncryptedSecret {
  assertValidKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    algorithm: ALGORITHM,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptSecret(encrypted: EncryptedSecret, key: Buffer): string {
  assertValidKey(key);
  if (encrypted.algorithm !== ALGORITHM) {
    throw new Error(`Unsupported secret algorithm: ${encrypted.algorithm}`);
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(encrypted.iv, "base64"));
  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export async function loadOrCreateMasterKey(path: string): Promise<Buffer> {
  try {
    return await readMasterKey(path);
  } catch (error) {
    if (!(error instanceof Error) || !isMissingFileError(error)) throw error;
  }

  await mkdir(dirname(path), { recursive: true });
  const key = randomBytes(KEY_BYTES);
  await writeFile(path, `${key.toString("base64")}\n`, { encoding: "utf8", mode: 0o600 });
  return key;
}

export async function readMasterKey(path: string): Promise<Buffer> {
  const raw = await readFile(path, "utf8");
  const key = Buffer.from(raw.trim(), "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error("Invalid Jira master key: expected 32 bytes");
  }
  return key;
}

export async function readSecretStore(path: string): Promise<SecretStore> {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as SecretStore;
  return parsed;
}

export async function writeSecretStore(path: string, store: SecretStore): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(store, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function assertValidKey(key: Buffer): void {
  if (key.length !== KEY_BYTES) {
    throw new Error("Invalid Jira master key: expected 32 bytes");
  }
}

function isMissingFileError(error: Error): boolean {
  return "code" in error && (error as { code?: unknown }).code === "ENOENT";
}
