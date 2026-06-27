import assert from "node:assert/strict";
import { test } from "node:test";

import { buildDoctorReport, registerWebSearchDoctorCommand } from "./doctor.ts";

test("buildDoctorReport reports auth status without leaking secrets", async () => {
  const report = await buildDoctorReport({
    version: "0.test",
    env: { OPENAI_API_KEY: "sk-test-secret" },
    resolveAuth: async () => ({
      route: "openai-api-key",
      provider: "openai",
      apiKey: "sk-test-secret",
      model: "gpt-4.1-mini",
      headers: { Authorization: "Bearer sk-test-secret" },
    }),
  });

  assert.match(report, /Web Search doctor/i);
  assert.match(report, /Version: 0\.test/);
  assert.match(report, /OPENAI_API_KEY: present/);
  assert.match(report, /Search auth: available via openai-api-key/);
  assert.match(report, /Model: gpt-4\.1-mini/);
  assert.doesNotMatch(report, /sk-test-secret/);
  assert.doesNotMatch(report, /Authorization/i);
});

test("buildDoctorReport gives setup guidance when auth is unavailable", async () => {
  const report = await buildDoctorReport({
    version: "0.test",
    env: {},
    resolveAuth: async () => undefined,
  });

  assert.match(report, /OPENAI_API_KEY: absent/);
  assert.match(report, /Search auth: unavailable/);
  assert.match(report, /Use \/login/i);
  assert.match(report, /Set OPENAI_API_KEY/i);
  assert.match(report, /SSRF guard: enabled/);
  assert.match(report, /Browser cookies: disabled/);
  assert.match(report, /JavaScript rendering: disabled/);
  assert.match(report, /Storage: session-local only/);
});

test("registerWebSearchDoctorCommand registers a user-facing diagnostics command", async () => {
  const commands: Array<{ name: string; description?: string; handler: (args: string, ctx: { ui: { notify(message: string, level?: "info" | "error" | "warning"): void } }) => Promise<void> }> = [];
  const notifications: Array<{ message: string; level?: "info" | "error" | "warning" }> = [];

  registerWebSearchDoctorCommand({
    registerCommand(name, command) {
      commands.push({ name, description: command.description, handler: command.handler });
    },
  }, {
    version: "0.test",
    env: {},
    resolveAuth: async () => undefined,
  });

  assert.equal(commands.length, 1);
  assert.equal(commands[0]?.name, "web-search-doctor");
  assert.match(commands[0]?.description ?? "", /diagnose/i);

  await commands[0]!.handler("", {
    ui: {
      notify(message: string, level?: "info" | "error" | "warning") {
        notifications.push({ message, level });
      },
    },
  });

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.level, "info");
  assert.match(notifications[0]?.message ?? "", /Web Search doctor/);
});
