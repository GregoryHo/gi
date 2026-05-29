import assert from "node:assert/strict";
import test from "node:test";

import type { AutocompleteProvider } from "@earendil-works/pi-tui";

import {
  createJiraAutocompleteProvider,
  extractJiraAutocompleteToken,
  filterJiraIssueSuggestions,
  MAX_AUTOCOMPLETE_SUGGESTIONS,
} from "./jira-autocomplete.ts";
import type { CompactJiraIssue } from "./issue-mapper.ts";

function issue(key: string, summary = `${key} summary`, status = "BACKLOG"): CompactJiraIssue {
  return {
    key,
    url: `https://jira.example.com/browse/${key}`,
    summary,
    status,
    statusCategory: "new",
    labels: [],
    descriptionTruncated: false,
  };
}

function provider(): AutocompleteProvider {
  return {
    async getSuggestions() {
      return { prefix: "", items: [{ value: "fallback", label: "fallback" }] };
    },
    applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
      return { lines, cursorLine, cursorCol, item, prefix } as never;
    },
    shouldTriggerFileCompletion() {
      return true;
    },
  };
}

test("extractJiraAutocompleteToken detects Jira key prefixes", () => {
  assert.deepEqual(extractJiraAutocompleteToken("please inspect CHATAPP-54"), {
    prefix: "CHATAPP-54",
    query: "CHATAPP-54",
    shorthand: false,
  });

  assert.deepEqual(extractJiraAutocompleteToken("/jira-plan CHATAPP-"), {
    prefix: "CHATAPP-",
    query: "CHATAPP-",
    shorthand: false,
  });
});

test("extractJiraAutocompleteToken detects shorthand only when project is configured", () => {
  assert.deepEqual(extractJiraAutocompleteToken("look at #5421", "CHATAPP"), {
    prefix: "#5421",
    query: "CHATAPP-5421",
    shorthand: true,
  });

  assert.equal(extractJiraAutocompleteToken("look at #5421"), undefined);
});

test("extractJiraAutocompleteToken ignores non-Jira text", () => {
  assert.equal(extractJiraAutocompleteToken("normal text"), undefined);
});

test("filterJiraIssueSuggestions returns bounded issue key suggestions", () => {
  const issues = Array.from({ length: MAX_AUTOCOMPLETE_SUGGESTIONS + 5 }, (_, index) =>
    issue(`CHATAPP-${5400 + index}`, `Issue ${index}`),
  );

  const suggestions = filterJiraIssueSuggestions(issues, "CHATAPP-54");

  assert.equal(suggestions.length, MAX_AUTOCOMPLETE_SUGGESTIONS);
  assert.equal(suggestions[0]?.value, "CHATAPP-5400");
  assert.equal(suggestions[0]?.description, "[BACKLOG] Issue 0");
});

test("filterJiraIssueSuggestions supports shorthand numeric query", () => {
  const suggestions = filterJiraIssueSuggestions(
    [issue("CHATAPP-5421", "Settings API"), issue("CHATAPP-1234", "Other")],
    "CHATAPP-5421",
  );

  assert.deepEqual(suggestions.map((item) => item.value), ["CHATAPP-5421"]);
});

test("createJiraAutocompleteProvider delegates when no Jira token matches", async () => {
  const autocomplete = createJiraAutocompleteProvider(provider(), async () => [issue("CHATAPP-5421")], "CHATAPP");
  const result = await autocomplete.getSuggestions(["normal text"], 0, "normal text".length, {
    signal: new AbortController().signal,
  });

  assert.equal(result?.items[0]?.value, "fallback");
});

test("createJiraAutocompleteProvider returns Jira suggestions for matching token", async () => {
  const autocomplete = createJiraAutocompleteProvider(provider(), async () => [issue("CHATAPP-5421", "Settings API")], "CHATAPP");
  const result = await autocomplete.getSuggestions(["/jira-plan CHATAPP-5"], 0, "/jira-plan CHATAPP-5".length, {
    signal: new AbortController().signal,
  });

  assert.equal(result?.prefix, "CHATAPP-5");
  assert.deepEqual(result?.items.map((item) => item.value), ["CHATAPP-5421"]);
});
