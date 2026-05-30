import assert from "node:assert/strict";
import test from "node:test";

import { createFacetValuePickerComponent, pageFacetValues } from "./facet-picker.ts";

test("pageFacetValues filters and pages large facet value lists", () => {
  const values = Array.from({ length: 25 }, (_, index) => ({ value: `v${index + 1}`, label: `Version ${index + 1}` }));

  assert.deepEqual(pageFacetValues(values, { query: "2", startAt: 0, maxResults: 5 }), {
    startAt: 0,
    maxResults: 5,
    total: 8,
    returned: 5,
    isLast: false,
    values: [
      { value: "v2", label: "Version 2" },
      { value: "v12", label: "Version 12" },
      { value: "v20", label: "Version 20" },
      { value: "v21", label: "Version 21" },
      { value: "v22", label: "Version 22" },
    ],
  });
});

test("createFacetValuePickerComponent emits select next previous filter clear and cancel", () => {
  const actions: string[] = [];
  const component = createFacetValuePickerComponent(
    {
      title: "Fix Version",
      pageInfo: "Values: 2 of 3",
      values: [
        { value: "v1.2", label: "v1.2" },
        { value: "v1.1", label: "v1.1" },
      ],
      canNext: true,
      canPrevious: true,
    },
    (action) => actions.push(action.type === "select" ? `select:${action.item.value}` : action.type),
  );

  assert.match(component.render(80).join("\n"), /> v1.2/);
  component.handleInput?.("\u001b[B");
  component.handleInput?.("\r");
  component.handleInput?.("n");
  component.handleInput?.("p");
  component.handleInput?.("/");
  component.handleInput?.("c");
  component.handleInput?.("\u001b");

  assert.deepEqual(actions, ["select:v1.1", "next", "previous", "filter", "clear", "cancel"]);
});
