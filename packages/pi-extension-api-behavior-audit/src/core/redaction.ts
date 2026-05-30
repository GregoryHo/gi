import type { ApiExchange } from "../types.ts";

export const REDACTED = "[REDACTED]";
export const REDACTION_POLICY = "default-v1";

const DEFAULT_SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-csrf-token",
  "x-xsrf-token",
]);

const DEFAULT_SENSITIVE_KEY_PARTS = [
  "password",
  "passwd",
  "token",
  "secret",
  "cookie",
  "session",
  "authorization",
  "csrf",
];

export interface RedactionOptions {
  marker?: string;
  sensitiveHeaders?: Iterable<string>;
  sensitiveKeyParts?: readonly string[];
}

function marker(options?: RedactionOptions): string {
  return options?.marker ?? REDACTED;
}

function isSensitiveKey(key: string, options?: RedactionOptions): boolean {
  const lower = key.toLowerCase();
  return (options?.sensitiveKeyParts ?? DEFAULT_SENSITIVE_KEY_PARTS).some((part) => lower.includes(part));
}

export function redactHeaders(
  headers: Record<string, unknown>,
  options?: RedactionOptions,
): Record<string, unknown> {
  const sensitiveHeaders = new Set(
    [...(options?.sensitiveHeaders ?? DEFAULT_SENSITIVE_HEADERS)].map((name) => name.toLowerCase()),
  );

  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      sensitiveHeaders.has(key.toLowerCase()) || isSensitiveKey(key, options) ? marker(options) : value,
    ]),
  );
}

export function redactJsonLike(value: unknown, options?: RedactionOptions): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactJsonLike(item, options));
  }

  if (typeof value === "string" && isUrlLike(value)) {
    return redactUrl(value, options);
  }

  if (typeof value === "string" && isJsonLikeString(value)) {
    try {
      return redactJsonLike(JSON.parse(value), options);
    } catch {
      return value;
    }
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      isSensitiveKey(key, options) ? marker(options) : redactJsonLike(item, options),
    ]),
  );
}

function isUrlLike(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/");
}

function isJsonLikeString(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

export function redactUrl(rawUrl: string, options?: RedactionOptions): string {
  const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(rawUrl);
  const base = "http://api-audit.local";
  const url = new URL(rawUrl, base);

  for (const key of [...url.searchParams.keys()]) {
    if (isSensitiveKey(key, options)) {
      url.searchParams.set(key, marker(options));
    }
  }

  if (isAbsolute) {
    return url.toString();
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function sanitizeExchange(exchange: ApiExchange, options?: RedactionOptions): ApiExchange {
  return {
    ...exchange,
    request: {
      ...exchange.request,
      url: redactUrl(exchange.request.url, options),
      headers: redactHeaders(exchange.request.headers, options),
      body: redactJsonLike(exchange.request.body, options),
    },
    response: {
      ...exchange.response,
      headers: redactHeaders(exchange.response.headers, options),
      body: redactJsonLike(exchange.response.body, options),
    },
  };
}
