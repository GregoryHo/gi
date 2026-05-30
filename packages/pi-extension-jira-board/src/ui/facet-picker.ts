import { createPagedPickerComponent, type PickerAction } from "../commands/browser.ts";

export interface FacetValueItem {
  value: string;
  label: string;
  description?: string;
}

export interface FacetValuePage {
  startAt: number;
  maxResults: number;
  total: number;
  returned: number;
  isLast: boolean;
  values: FacetValueItem[];
}

export interface FacetValuePickerOptions {
  title: string;
  pageInfo: string;
  values: FacetValueItem[];
  canNext: boolean;
  canPrevious: boolean;
}

export function pageFacetValues(
  values: FacetValueItem[],
  params: { query?: string; startAt?: number; maxResults?: number } = {},
): FacetValuePage {
  const query = params.query?.trim().toLowerCase();
  const filtered = query
    ? values.filter((value) => `${value.label} ${value.description ?? ""}`.toLowerCase().includes(query))
    : values;
  const startAt = Math.max(0, Math.floor(params.startAt ?? 0));
  const maxResults = Math.max(1, Math.min(Math.floor(params.maxResults ?? 10), 50));
  const page = filtered.slice(startAt, startAt + maxResults);

  return {
    startAt,
    maxResults,
    total: filtered.length,
    returned: page.length,
    isLast: startAt + page.length >= filtered.length,
    values: page,
  };
}

export function createFacetValuePickerComponent(
  options: FacetValuePickerOptions,
  done: (action: PickerAction<string>) => void,
): ReturnType<typeof createPagedPickerComponent<string>> {
  return createPagedPickerComponent(
    {
      title: options.title,
      pageInfo: options.pageInfo,
      items: options.values.map((value) => ({ value: value.value, label: value.label, description: value.description })),
      canNext: options.canNext,
      canPrevious: options.canPrevious,
    },
    done,
  );
}
