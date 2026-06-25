import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
  buildOpenAIRequestBody,
  normalizeSearchParams,
  parseOpenAIResponseText,
  type SearchSource,
} from "./results.ts";

export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
export const CODEX_RESPONSES_URL = "https://chatgpt.com/backend-api/codex/responses";

const SEARCH_TIMEOUT_MS = 60_000;
const OPENAI_CODEX_MODEL_CANDIDATES = ["gpt-5.4", "gpt-5.3-codex", "gpt-5.3-codex-spark", "gpt-5.2"] as const;
const OPENAI_MODEL_CANDIDATES = ["gpt-5.4", "gpt-5.2", "gpt-5.2-codex", "gpt-4.1-mini", "gpt-4o"] as const;

export type AuthRoute = "openai-codex" | "openai-pi" | "openai-api-key";

export interface OpenAIAuth {
  route: AuthRoute;
  provider: "openai-codex" | "openai";
  apiKey: string;
  model: string;
  headers: Record<string, string>;
}

export interface OpenAISearchResult {
  query: string;
  authRoute: AuthRoute;
  answer: string;
  sources: SearchSource[];
}

export interface SearchWithOpenAIOptions {
  query: string;
  count?: number;
  domainFilter?: string[];
  signal?: AbortSignal;
  ctx?: ExtensionContext;
  resolveAuth?: () => Promise<OpenAIAuth | undefined>;
  fetchImpl?: typeof fetch;
}

export async function resolveOpenAIAuth(ctx?: ExtensionContext): Promise<OpenAIAuth | undefined> {
  if (ctx) {
    const { getModel } = await import("@earendil-works/pi-ai");
    for (const modelId of OPENAI_CODEX_MODEL_CANDIDATES) {
      const model = getModel("openai-codex", modelId);
      if (!model) continue;
      try {
        const resolved = await ctx.modelRegistry.getApiKeyAndHeaders(model);
        if (resolved.ok && resolved.apiKey) {
          return {
            route: "openai-codex",
            provider: "openai-codex",
            apiKey: resolved.apiKey,
            model: modelId,
            headers: resolved.headers ?? {},
          };
        }
      } catch {
      }
    }

    for (const modelId of OPENAI_MODEL_CANDIDATES) {
      const model = getModel("openai", modelId);
      if (!model) continue;
      try {
        const resolved = await ctx.modelRegistry.getApiKeyAndHeaders(model);
        if (resolved.ok && resolved.apiKey) {
          return {
            route: "openai-pi",
            provider: "openai",
            apiKey: resolved.apiKey,
            model: modelId,
            headers: resolved.headers ?? {},
          };
        }
      } catch {
      }
    }
  }

  const apiKey = normalizeApiKey(process.env.OPENAI_API_KEY);
  return apiKey
    ? { route: "openai-api-key", provider: "openai", apiKey, model: "gpt-4.1-mini", headers: {} }
    : undefined;
}

function normalizeApiKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export async function searchWithOpenAI(options: SearchWithOpenAIOptions): Promise<OpenAISearchResult> {
  const params = normalizeSearchParams({
    query: options.query,
    count: options.count,
    domainFilter: options.domainFilter,
  });
  const auth = await (options.resolveAuth ?? (() => resolveOpenAIAuth(options.ctx)))();
  if (!auth) {
    throw new Error(
      "OpenAI web search unavailable. Either:\n" +
      "  1. Use /login to sign in with an OpenAI/Codex subscription in pi\n" +
      "  2. Set OPENAI_API_KEY in the environment",
    );
  }

  const headers: Record<string, string> = {
    ...auth.headers,
    Authorization: `Bearer ${auth.apiKey}`,
    "Content-Type": "application/json",
    "OpenAI-Beta": "responses=experimental",
  };
  const useCodexEndpoint = auth.provider === "openai-codex" || isCodexJwt(auth.apiKey);
  if (useCodexEndpoint) {
    const accountId = extractAccountId(auth.apiKey);
    if (accountId) headers["chatgpt-account-id"] = accountId;
    headers.originator = "pi";
  }

  const body = buildOpenAIRequestBody({
    model: auth.model,
    query: params.query,
    count: params.count,
    domainFilters: params.domainFilters,
  });

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(useCodexEndpoint ? CODEX_RESPONSES_URL : OPENAI_RESPONSES_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: requestSignal(options.signal),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI web search error ${response.status}: ${errorText.slice(0, 300)}`);
  }

  const parsed = parseOpenAIResponseText(await response.text(), params.count);
  if (!parsed.answer && parsed.sources.length === 0) {
    throw new Error("OpenAI web search returned no answer or sources.");
  }

  return {
    query: params.query,
    authRoute: auth.route,
    answer: parsed.answer,
    sources: parsed.sources,
  };
}

function requestSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(SEARCH_TIMEOUT_MS);
  return signal ? AbortSignal.any([timeout, signal]) : timeout;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    const parsed = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as unknown;
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function isCodexJwt(token: string): boolean {
  const payload = decodeJwtPayload(token);
  return !!payload?.["https://api.openai.com/auth"];
}

function extractAccountId(token: string): string | undefined {
  const payload = decodeJwtPayload(token);
  const auth = payload?.["https://api.openai.com/auth"];
  if (!auth || typeof auth !== "object") return undefined;
  const id = (auth as Record<string, unknown>).chatgpt_account_id;
  return typeof id === "string" && id.trim() ? id.trim() : undefined;
}
