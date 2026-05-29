import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  decryptSecret,
  encryptSecret,
  loadOrCreateMasterKey,
  readSecretStore,
  writeSecretStore,
} from "./secret-store.ts";

test("encryptSecret stores decryptable AES-GCM data without plaintext", () => {
  const key = Buffer.alloc(32, 7);
  const encrypted = encryptSecret("secret-token", key);

  assert.equal(encrypted.algorithm, "aes-256-gcm");
  assert.equal(JSON.stringify(encrypted).includes("secret-token"), false);
  assert.equal(decryptSecret(encrypted, key), "secret-token");
});

test("decryptSecret rejects unsupported algorithms", () => {
  const key = Buffer.alloc(32, 7);
  const encrypted = encryptSecret("secret-token", key);

  assert.throws(() => decryptSecret({ ...encrypted, algorithm: "plain" }, key), /Unsupported secret algorithm/);
});

test("loadOrCreateMasterKey creates a stable 32 byte key with restricted mode", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jira-secret-store-"));
  const keyPath = join(dir, "master.key");

  const first = await loadOrCreateMasterKey(keyPath);
  const second = await loadOrCreateMasterKey(keyPath);

  assert.equal(first.length, 32);
  assert.deepEqual(second, first);

  const raw = await readFile(keyPath, "utf8");
  assert.equal(Buffer.from(raw.trim(), "base64").length, 32);

  if (process.platform !== "win32") {
    const mode = (await stat(keyPath)).mode & 0o777;
    assert.equal(mode, 0o600);
  }
});

test("writeSecretStore persists encrypted secrets without plaintext", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jira-secret-store-"));
  const path = join(dir, "secrets.json");
  const key = Buffer.alloc(32, 8);
  const encrypted = encryptSecret("secret-token", key);

  await writeSecretStore(path, { default: encrypted });

  const raw = await readFile(path, "utf8");
  assert.equal(raw.includes("secret-token"), false);
  assert.deepEqual(await readSecretStore(path), { default: encrypted });
});
