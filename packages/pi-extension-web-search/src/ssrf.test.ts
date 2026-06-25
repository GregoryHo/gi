import assert from "node:assert/strict";
import { test } from "node:test";

import { fetchPublicUrl, validatePublicUrl } from "./ssrf.ts";

test("validatePublicUrl rejects non-http schemes and localhost", async () => {
  await assert.rejects(() => validatePublicUrl("file:///etc/passwd"), /Only HTTP and HTTPS/);
  await assert.rejects(() => validatePublicUrl("http://localhost:3000"), /Blocked internal hostname/);
  await assert.rejects(() => validatePublicUrl("https://app.localhost"), /Blocked internal hostname/);
});

test("validatePublicUrl rejects private and reserved IPs", async () => {
  await assert.rejects(() => validatePublicUrl("http://127.0.0.1"), /Blocked internal address/);
  await assert.rejects(() => validatePublicUrl("http://10.0.0.5"), /Blocked internal address/);
  await assert.rejects(() => validatePublicUrl("http://192.168.1.10"), /Blocked internal address/);
  await assert.rejects(() => validatePublicUrl("http://[::1]"), /Blocked internal address/);
});

test("validatePublicUrl resolves hostnames and rejects private DNS answers", async () => {
  await assert.rejects(
    () => validatePublicUrl("https://example.com", {
      lookup: async () => [{ address: "192.168.1.5", family: 4 }],
    }),
    /Blocked internal address for example.com: 192.168.1.5/,
  );
});

test("fetchPublicUrl validates redirect targets before following", async () => {
  const calls: string[] = [];
  await assert.rejects(
    () => fetchPublicUrl("https://example.com/start", {
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      fetchImpl: async (url) => {
        calls.push(String(url));
        return new Response("", {
          status: 302,
          headers: { location: "http://127.0.0.1/admin" },
        });
      },
    }),
    /Blocked internal address/,
  );

  assert.deepEqual(calls, ["https://example.com/start"]);
});
