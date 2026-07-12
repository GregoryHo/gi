import { lookup as dnsLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { Readable } from "node:stream";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const DEFAULT_MAX_REDIRECTS = 5;

export interface LookupAddress {
  address: string;
  family: number;
}

export type Lookup = (hostname: string) => Promise<LookupAddress[]>;

interface ValidateOptions {
  lookup?: Lookup;
}

type PinnedRequest = (url: URL, init: RequestInit, addresses: LookupAddress[]) => Promise<Response>;

interface FetchPublicUrlOptions extends ValidateOptions {
  fetchImpl?: typeof fetch;
  requestImpl?: PinnedRequest;
  init?: RequestInit;
  maxRedirects?: number;
}

export interface PublicFetchResult {
  response: Response;
  finalUrl: string;
}

async function defaultLookup(hostname: string): Promise<LookupAddress[]> {
  return dnsLookup(hostname, { all: true, verbatim: true });
}

export async function validatePublicUrl(rawUrl: string | URL, options: ValidateOptions = {}): Promise<URL> {
  return (await resolvePublicUrl(rawUrl, options)).url;
}

async function resolvePublicUrl(rawUrl: string | URL, options: ValidateOptions): Promise<{ url: URL; addresses: LookupAddress[] }> {
  const url = rawUrl instanceof URL ? rawUrl : new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs can be fetched remotely");
  }
  if (url.username || url.password) throw new Error("URL credentials are not allowed");

  const hostname = normalizeHostname(url.hostname);
  if (!hostname) throw new Error("URL must include a hostname");
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error(`Blocked internal hostname: ${hostname}`);
  }

  const ipVersion = net.isIP(hostname);
  if (ipVersion) {
    assertPublicAddress(hostname, hostname);
	return { url, addresses: [{ address: hostname, family: ipVersion }] };
  }

  let addresses: LookupAddress[];
  try {
    addresses = await (options.lookup ?? defaultLookup)(hostname);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to resolve ${hostname}: ${message}`);
  }

  if (addresses.length === 0) throw new Error(`Failed to resolve ${hostname}: no addresses returned`);
  for (const { address } of addresses) assertPublicAddress(address, hostname);
  return { url, addresses };
}

export async function fetchPublicUrl(rawUrl: string | URL, options: FetchPublicUrlOptions = {}): Promise<PublicFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  let resolved = await resolvePublicUrl(rawUrl, options);
  let current = resolved.url;
  let init = options.init ?? {};

  for (let redirects = 0; redirects <= maxRedirects; redirects++) {
	const request = options.requestImpl ?? (options.fetchImpl ? ((url: URL, requestInit: RequestInit) => fetchImpl(url, requestInit)) : fetchPinnedUrl);
	const response = await request(current, { ...init, redirect: "manual" }, resolved.addresses);
    if (!REDIRECT_STATUSES.has(response.status)) {
      return { response, finalUrl: current.toString() };
    }

    const location = response.headers.get("location");
    if (!location) return { response, finalUrl: current.toString() };
    if (redirects === maxRedirects) throw new Error(`Too many redirects fetching ${current.toString()}`);

	resolved = await resolvePublicUrl(new URL(location, current), options);
	current = resolved.url;
    if (response.status === 303 || ((response.status === 301 || response.status === 302) && init.method?.toUpperCase() === "POST")) {
      const { body: _body, ...nextInit } = init;
      init = { ...nextInit, method: "GET" };
    }
  }

  throw new Error(`Too many redirects fetching ${current.toString()}`);
}

async function fetchPinnedUrl(url: URL, init: RequestInit, addresses: LookupAddress[]): Promise<Response> {
  const selected = addresses[0];
  if (!selected) throw new Error(`No validated address available for ${url.hostname}`);
  const transport = url.protocol === "https:" ? https : http;
  const headers = Object.fromEntries(new Headers(init.headers).entries());

  return new Promise<Response>((resolve, reject) => {
	const request = transport.request({
	  protocol: url.protocol,
	  hostname: url.hostname,
	  port: url.port || undefined,
	  path: `${url.pathname}${url.search}`,
	  method: init.method ?? "GET",
	  headers,
	  signal: init.signal ?? undefined,
	  lookup: (_hostname, lookupOptions, callback) => {
		if (lookupOptions.all) callback(null, addresses);
		else callback(null, selected.address, selected.family);
	  },
	}, (response) => {
	  const responseHeaders = new Headers();
	  for (let index = 0; index < response.rawHeaders.length; index += 2) {
		responseHeaders.append(response.rawHeaders[index]!, response.rawHeaders[index + 1] ?? "");
	  }
	  const status = response.statusCode ?? 500;
	  const body = status === 204 || status === 304 ? null : Readable.toWeb(response) as ReadableStream<Uint8Array>;
	  resolve(new Response(body, { status, statusText: response.statusMessage, headers: responseHeaders }));
	});
	request.on("error", reject);
	if (typeof init.body === "string" || init.body instanceof Uint8Array) request.write(init.body);
	else if (init.body != null) {
	  request.destroy();
	  reject(new Error("Pinned public fetch supports string or byte request bodies only"));
	  return;
	}
	request.end();
  });
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
}

function assertPublicAddress(address: string, hostname: string): void {
  const normalized = normalizeHostname(address);
  const ipVersion = net.isIP(normalized);
  if (ipVersion === 0) throw new Error(`Resolved non-IP address for ${hostname}: ${address}`);
  if (ipVersion === 4 && isBlockedIPv4(normalized)) {
    throw new Error(`Blocked internal address for ${hostname}: ${normalized}`);
  }
  if (ipVersion === 6 && isBlockedIPv6(normalized)) {
    throw new Error(`Blocked internal address for ${hostname}: ${normalized}`);
  }
}

function isBlockedIPv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
	(a === 192 && b === 0 && (parts[2] === 0 || parts[2] === 2)) ||
	(a === 198 && (b === 18 || b === 19 || (b === 51 && parts[2] === 100))) ||
	(a === 203 && b === 0 && parts[2] === 113) ||
    a >= 224;
}

function isBlockedIPv6(address: string): boolean {
  const groups = parseIPv6(address);
  if (!groups) return true;

  const first = groups[0];
  if (groups.every((group) => group === 0)) return true;
  if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) return true;
  if ((first & 0xfe00) === 0xfc00) return true;
  if ((first & 0xffc0) === 0xfe80) return true;
  if ((first & 0xff00) === 0xff00) return true;
  if (first === 0x2001 && groups[1] === 0x0db8) return true;

  const isMappedIPv4 = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (isMappedIPv4) {
    const ipv4 = [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join(".");
    return isBlockedIPv4(ipv4);
  }

  return false;
}

function parseIPv6(address: string): number[] | null {
  if (address.includes(".")) {
    const lastColon = address.lastIndexOf(":");
    const ipv4 = address.slice(lastColon + 1);
    if (net.isIP(ipv4) !== 4) return null;
    const octets = ipv4.split(".").map((part) => Number(part));
    address = `${address.slice(0, lastColon)}:${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }

  const pieces = address.split("::");
  if (pieces.length > 2) return null;
  const left = pieces[0] ? pieces[0].split(":") : [];
  const right = pieces.length === 2 && pieces[1] ? pieces[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (pieces.length === 1 && missing !== 0) return null;
  if (pieces.length === 2 && missing < 0) return null;

  const groups = [...left, ...Array(missing).fill("0"), ...right].map((part) => {
    if (!/^[0-9a-f]{1,4}$/i.test(part)) return -1;
    return parseInt(part, 16);
  });
  return groups.length === 8 && groups.every((group) => group >= 0 && group <= 0xffff) ? groups : null;
}
