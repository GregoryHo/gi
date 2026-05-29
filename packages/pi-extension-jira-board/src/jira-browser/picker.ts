import { Key, matchesKey, truncateToWidth, type Component } from "@earendil-works/pi-tui";

import type { CompactJiraIssue } from "../issue-mapper.ts";
import type { JiraProject } from "../jira-types.ts";
import type { JiraProjectPage } from "../jira-query.ts";
import { BROWSE_PAGE_SIZE, MAX_WIDGET_ISSUES, type IssueBrowserPage, type PagedPickerOptions, type PickerAction, type PickerItem } from "./types.ts";

export function createPagedPickerComponent<T>(
  options: PagedPickerOptions<T>,
  done: (action: PickerAction<T>) => void,
): Component {
  let selectedIndex = 0;

  return {
    render(width: number): string[] {
      const lines: string[] = [];
      lines.push(truncateToWidth(options.title, width));
      lines.push(truncateToWidth(options.pageInfo, width));
      lines.push("");

      if (options.items.length === 0) {
        lines.push(truncateToWidth("No results", width));
      }

      for (let i = 0; i < options.items.length; i++) {
        const item = options.items[i];
        const prefix = i === selectedIndex ? "> " : "  ";
        lines.push(truncateToWidth(`${prefix}${item.label}`, width));
        if (item.description) {
          lines.push(truncateToWidth(`    ${item.description}`, width));
        }
      }

      lines.push("");
      const nav = [
        "↑↓ select",
        "Enter choose",
        options.canPrevious ? "p prev" : undefined,
        options.canNext ? "n next" : undefined,
        "f filter",
        "c clear",
        "Esc cancel",
      ].filter(Boolean);
      lines.push(truncateToWidth(nav.join(" • "), width));
      return lines;
    },
    handleInput(data: string): void {
      if (matchesKey(data, Key.up)) {
        selectedIndex = Math.max(0, selectedIndex - 1);
        return;
      }
      if (matchesKey(data, Key.down)) {
        selectedIndex = Math.min(options.items.length - 1, selectedIndex + 1);
        return;
      }
      if (matchesKey(data, Key.enter) && options.items[selectedIndex]) {
        done({ type: "select", item: options.items[selectedIndex] });
        return;
      }
      if (data === "n" && options.canNext) {
        done({ type: "next" });
        return;
      }
      if (data === "p" && options.canPrevious) {
        done({ type: "previous" });
        return;
      }
      if (data === "/" || data === "f") {
        done({ type: "filter" });
        return;
      }
      if (data === "c") {
        done({ type: "clear" });
        return;
      }
      if (matchesKey(data, Key.escape)) {
        done({ type: "cancel" });
      }
    },
    invalidate(): void {},
  };
}


export function formatProjectCardWidget(project: JiraProject, page?: JiraProjectPage): string[] {
  const lines = ["Selected Jira project", `${project.key}: ${project.name}`, `ID: ${project.id}`];
  if (page) {
    lines.push(`Project page: ${page.returned} of ${page.total} · startAt ${page.startAt}`);
  }
  return lines;
}

export function formatIssueCardsWidget(input: {
  title: string;
  jql: string;
  startAt: number;
  total: number;
  returned: number;
  issues: CompactJiraIssue[];
}): string[] {
  const lines = [
    `${input.title} · ${input.returned}/${input.total} · startAt ${input.startAt}`,
    `JQL: ${input.jql}`,
    "",
  ];

  for (const issue of input.issues.slice(0, MAX_WIDGET_ISSUES)) {
    lines.push(`${issue.key}  ${issue.status}${issue.priority ? `  ${issue.priority}` : ""}`);
    lines.push(issue.summary);
    const meta = [`assignee: ${issue.assignee ?? "unassigned"}`];
    meta.push(`labels: ${issue.labels.length > 0 ? issue.labels.join(", ") : "none"}`);
    lines.push(meta.join(" · "));
    lines.push("");
  }

  return lines.filter((line, index, all) => !(line === "" && index === all.length - 1));
}


export async function showProjectPicker(
  ctx: {
    ui: {
      custom<T>(factory: (tui: { requestRender(): void }, theme: unknown, keybindings: unknown, done: (result: T) => void) => Component): Promise<T>;
    };
  },
  page: JiraProjectPage,
): Promise<PickerAction<JiraProject>> {
  return ctx.ui.custom<PickerAction<JiraProject>>((tui, _theme, _keybindings, done) => {
    const component = createPagedPickerComponent<JiraProject>(
      {
        title: "Jira projects",
        pageInfo: `Projects: ${page.returned} of ${page.total} · startAt ${page.startAt}`,
        items: page.projects.map((project) => ({
          value: project,
          label: project.key,
          description: project.name,
        })),
        canNext: !page.isLast,
        canPrevious: page.startAt > 0,
      },
      done,
    );
    return withRenderRequest(component, tui);
  });
}


export function createIssuePickerComponent(
  page: IssueBrowserPage,
  done: (action: PickerAction<CompactJiraIssue>) => void,
): Component {
  const component = createPagedPickerComponent<CompactJiraIssue>(
    {
      title: "Jira issues",
      pageInfo: `Issues: ${page.returned} of ${page.total} · startAt ${page.startAt}`,
      items: page.issues.map((issue) => ({
        value: issue,
        label: `${issue.key}: ${issue.summary}`,
        description: [issue.status, issue.priority, issue.assignee].filter(Boolean).join(" • "),
      })),
      canNext: !page.isLast,
      canPrevious: page.startAt > 0,
    },
    done,
  );

  return {
    ...component,
    render(width: number): string[] {
      const lines = component.render(width);
      const last = lines[lines.length - 1];
      if (last?.includes("Esc cancel") && !last.includes("s status")) {
        lines[lines.length - 1] = last.replace("Esc cancel", "s status • Esc cancel");
      }
      return lines;
    },
    handleInput(data: string): void {
      if (data === "s") {
        done({ type: "status" });
        return;
      }
      component.handleInput?.(data);
    },
  };
}


export async function showIssuePicker(
  ctx: {
    ui: {
      custom<T>(factory: (tui: { requestRender(): void }, theme: unknown, keybindings: unknown, done: (result: T) => void) => Component): Promise<T>;
    };
  },
  page: IssueBrowserPage,
): Promise<PickerAction<CompactJiraIssue>> {
  return ctx.ui.custom<PickerAction<CompactJiraIssue>>((tui, _theme, _keybindings, done) => {
    const component = createIssuePickerComponent(page, done);
    return withRenderRequest(component, tui);
  });
}


function withRenderRequest(component: Component, tui: { requestRender(): void }): Component {
  return {
    ...component,
    handleInput(data: string): void {
      component.handleInput?.(data);
      tui.requestRender();
    },
  };
}
