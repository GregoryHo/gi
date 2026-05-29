import assert from "node:assert/strict";
import test from "node:test";

import {
  createMaskedSecretInputComponent,
  formatOnboardingPreview,
  parseOnboardingBoardId,
  registerJiraOnboardingCommand,
} from "./jira-onboarding.ts";

test("parseOnboardingBoardId accepts blank optional board id", () => {
  assert.equal(parseOnboardingBoardId(undefined), undefined);
  assert.equal(parseOnboardingBoardId("  "), undefined);
});

test("parseOnboardingBoardId parses positive integers and rejects invalid values", () => {
  assert.equal(parseOnboardingBoardId("123"), 123);
  assert.throws(() => parseOnboardingBoardId("abc"), /positive integer/);
  assert.throws(() => parseOnboardingBoardId("0"), /positive integer/);
});

test("formatOnboardingPreview omits secret values", () => {
  const preview = formatOnboardingPreview({
    baseUrl: "https://jira.example.com",
    user: "jira-user",
    authType: "token",
    secret: "secret-token",
    project: "PROJ",
    boardId: 123,
  });

  assert.match(preview, /https:\/\/jira\.example\.com/);
  assert.match(preview, /jira-user/);
  assert.match(preview, /token/);
  assert.equal(preview.includes("secret-token"), false);
});

test("createMaskedSecretInputComponent renders bullets instead of plaintext", () => {
  let submitted: string | undefined;
  const component = createMaskedSecretInputComponent("Enter token", (value) => {
    submitted = value;
  });

  for (const char of "secret") component.handleInput?.(char);
  const rendered = component.render(80).join("\n");

  assert.match(rendered, /••••••/);
  assert.equal(rendered.includes("secret"), false);

  component.handleInput?.("\r");
  assert.equal(submitted, "secret");
});

test("registerJiraOnboardingCommand refuses without interactive UI", async () => {
  let registered: { description?: string; handler: (args: string, ctx: unknown) => Promise<void> } | undefined;
  const pi = {
    registerCommand(name: string, command: { description?: string; handler: (args: string, ctx: unknown) => Promise<void> }) {
      assert.equal(name, "jira-onboarding");
      registered = command;
    },
  };

  registerJiraOnboardingCommand(pi as never);

  let notification: { message: string; type?: string } | undefined;
  await registered?.handler("", {
    hasUI: false,
    ui: {
      notify(message: string, type?: string) {
        notification = { message, type };
      },
    },
  });

  assert.deepEqual(notification, {
    message: "/jira-onboarding requires interactive UI",
    type: "error",
  });
});
