export interface DomainFilters {
  allowedDomains?: string[];
  blockedDomains?: string[];
}

export interface NormalizedSearchParams {
  query: string;
  count: number;
  domainFilters: DomainFilters | null;
}

export interface SearchSource {
  id?: string;
  title: string;
  url: string;
  snippet: string;
}

export interface ParsedOpenAIResponse {
  answer: string;
  sources: SearchSource[];
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  details: Record<string, unknown>;
}

interface RawSearchParams {
  query?: unknown;
  count?: unknown;
  domainFilter?: unknown;
}

interface RequestBodyInput {
  model: string;
  query: string;
  count: number;
  domainFilters: DomainFilters | null;
}

export interface OpenAIRequestBody {
  model: string;
  instructions: string;
  input: Array<{ role: "user"; content: Array<{ type: "input_text"; text: string }> }>;
  tools: Array<Record<string, unknown>>;
  include: string[];
  store: false;
  stream: true;
  tool_choice: "required";
  parallel_tool_calls: true;
}

interface SearchToolResultInput extends ParsedOpenAIResponse {
  query: string;
  authRoute: string;
  responseId?: string;
}

const DEFAULT_COUNT = 5;
const MAX_COUNT = 10;

export function normalizeSearchParams(params: RawSearchParams): NormalizedSearchParams {
  const query = typeof params.query === "string" ? params.query.trim() : "";
  if (!query) throw new Error("web_search requires a non-empty query.");

  return {
    query,
    count: normalizeCount(params.count),
    domainFilters: normalizeDomainFilters(Array.isArray(params.domainFilter) ? params.domainFilter : undefined),
  };
}

function normalizeCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_COUNT;
  return Math.max(1, Math.min(Math.floor(value), MAX_COUNT));
}

function normalizeDomainFilters(values: unknown[] | undefined): DomainFilters | null {
  if (!values?.length) return null;

  const allowedDomains: string[] = [];
  const blockedDomains: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") continue;
    const blocked = value.trim().startsWith("-");
    const domain = normalizeDomain(value);
    if (!domain) continue;
    const target = blocked ? blockedDomains : allowedDomains;
    if (!target.includes(domain)) target.push(domain);
  }

  return allowedDomains.length > 0 || blockedDomains.length > 0
    ? {
      ...(allowedDomains.length > 0 ? { allowedDomains } : {}),
      ...(blockedDomains.length > 0 ? { blockedDomains } : {}),
    }
    : null;
}

function normalizeDomain(value: string): string | null {
  let input = value.trim().toLowerCase();
  if (input.startsWith("-")) input = input.slice(1).trim();
  if (!input) return null;

  try {
    const parsed = input.includes("://") ? new URL(input) : new URL(`https://${input}`);
    input = parsed.hostname;
  } catch {
    input = input.split("/")[0]?.split(":")[0] ?? "";
  }

  input = input.replace(/^\.+|\.+$/g, "");
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(input) ? input : null;
}

export function buildOpenAIRequestBody(input: RequestBodyInput): OpenAIRequestBody {
  return {
    model: input.model,
    instructions: buildInstructions(input.count, input.domainFilters),
    input: [{ role: "user", content: [{ type: "input_text", text: input.query }] }],
    tools: [buildWebSearchTool(input.domainFilters)],
    include: ["web_search_call.action.sources"],
    store: false,
    stream: true,
    tool_choice: "required",
    parallel_tool_calls: true,
  };
}

function buildInstructions(count: number, filters: DomainFilters | null): string {
  const lines = [
    "Search the web and return a concise answer grounded only in the web results.",
    "Include clickable source citations in the response text when possible.",
    `Prefer around ${count} distinct sources.`,
  ];
  if (filters?.allowedDomains?.length) lines.push(`Only use sources from: ${filters.allowedDomains.join(", ")}.`);
  if (filters?.blockedDomains?.length) lines.push(`Do not use sources from: ${filters.blockedDomains.join(", ")}.`);
  return lines.join(" ");
}

function buildWebSearchTool(filters: DomainFilters | null): Record<string, unknown> {
  const tool: Record<string, unknown> = { type: "web_search" };
  if (filters) {
    tool.filters = {
      ...(filters.allowedDomains ? { allowed_domains: filters.allowedDomains } : {}),
      ...(filters.blockedDomains ? { blocked_domains: filters.blockedDomains } : {}),
    };
  }
  return tool;
}

export function parseOpenAIResponseText(text: string, count: number): ParsedOpenAIResponse {
  const parsed = parseOpenAIWireText(text);
  const output = Array.isArray(parsed.output) ? parsed.output : [];
  const answer = extractAnswer(output);
  const sources = extractSources(output, count);
  return { answer, sources };
}

function parseOpenAIWireText(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) return { output: parsed };
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : { output: [] };
  }

  const outputItems: unknown[] = [];
  let completedResponse: Record<string, unknown> | null = null;
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const event = JSON.parse(data) as Record<string, unknown>;
      if (event.type === "response.output_item.done" && event.item) outputItems.push(event.item);
      if ((event.type === "response.done" || event.type === "response.completed") && event.response && typeof event.response === "object") {
        completedResponse = event.response as Record<string, unknown>;
      }
    } catch {
    }
  }

  if (completedResponse) {
    const completedOutput = Array.isArray(completedResponse.output) ? completedResponse.output : [];
    return completedOutput.length > 0 ? completedResponse : { ...completedResponse, output: outputItems };
  }
  return { output: outputItems };
}

function extractAnswer(output: unknown[]): string {
  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object" || (item as { type?: unknown }).type !== "message") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string" && text.trim()) parts.push(text.trim());
    }
  }
  return parts.join("\n");
}

function extractSources(output: unknown[], count: number): SearchSource[] {
  const sources: SearchSource[] = [];
  const seen = new Set<string>();

  for (const item of output) {
    if (!item || typeof item !== "object" || (item as { type?: unknown }).type !== "message") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = typeof (part as { text?: unknown }).text === "string" ? (part as { text: string }).text : "";
      const annotations = (part as { annotations?: unknown }).annotations;
      if (!Array.isArray(annotations)) continue;
      for (const annotation of annotations) {
        if (!annotation || typeof annotation !== "object" || (annotation as { type?: unknown }).type !== "url_citation") continue;
        addSource(sources, seen, {
          url: (annotation as { url?: unknown }).url,
          title: (annotation as { title?: unknown }).title,
          snippet: extractSnippet(text, (annotation as { start_index?: unknown }).start_index, (annotation as { end_index?: unknown }).end_index),
        });
      }
    }
  }

  for (const item of output) {
    if (!item || typeof item !== "object" || (item as { type?: unknown }).type !== "web_search_call") continue;
    const value = item as { action?: unknown; sources?: unknown; results?: unknown };
    const actionSources = value.action && typeof value.action === "object"
      ? (value.action as { sources?: unknown }).sources
      : undefined;
    for (const group of [actionSources, value.sources, value.results]) {
      if (!Array.isArray(group)) continue;
      for (const source of group) {
        if (!source || typeof source !== "object") continue;
        const record = source as Record<string, unknown>;
        addSource(sources, seen, {
          url: record.url ?? record.source_website_url,
          title: record.title ?? record.caption,
          snippet: "",
        });
      }
    }
  }

  return sources.slice(0, count);
}

function extractSnippet(text: string, start: unknown, end: unknown): string {
  if (typeof start !== "number" || typeof end !== "number" || !text) return "";
  const before = Math.max(0, start - 100);
  const after = Math.min(text.length, end + 100);
  const snippet = text.slice(before, after).replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").trim();
  return snippet.length > 300 ? `${snippet.slice(0, 297)}...` : snippet;
}

function addSource(
  sources: SearchSource[],
  seen: Set<string>,
  input: { url: unknown; title: unknown; snippet: string },
): void {
  if (typeof input.url !== "string" || !input.url.trim()) return;
  const url = cleanSourceUrl(input.url);
  if (seen.has(url)) return;
  seen.add(url);
  sources.push({
    title: typeof input.title === "string" && input.title.trim() ? input.title.trim() : url,
    url,
    snippet: input.snippet,
  });
}

function cleanSourceUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    if (url.searchParams.get("utm_source") === "openai") url.searchParams.delete("utm_source");
    return url.toString();
  } catch {
    return rawUrl.replace(/[?&]utm_source=openai$/, "");
  }
}

export function formatSearchToolResult(input: SearchToolResultInput): ToolResult {
  const sourceLines = input.sources.map((source, index) => {
    const id = source.id ?? `r${index + 1}`;
    return `${index + 1}. [${id}] ${source.title}\n   ${source.url}`;
  });
  const textParts = [input.answer || "OpenAI web search returned no answer text."];
  if (input.responseId) {
    textParts.push(`responseId: ${input.responseId}\nUse fetch_content with { responseId: "${input.responseId}", resultId: "r1" } or a different result id to read a source.`);
  }
  if (sourceLines.length > 0) textParts.push(`Sources:\n${sourceLines.join("\n")}`);
  return {
    content: [{ type: "text", text: textParts.join("\n\n") }],
    details: {
      provider: "openai",
      authRoute: input.authRoute,
      ...(input.responseId ? { responseId: input.responseId } : {}),
      query: input.query,
      sourceCount: input.sources.length,
      sources: input.sources,
    },
  };
}
