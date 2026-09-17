import { execFile } from "node:child_process";
import type { IncomingHttpHeaders } from "node:http";
import https from "node:https";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 16,
  timeout: 15_000,
});
import {
  MAX_SCORE_BODY_BYTES,
  SCORE_FETCH_TIMEOUT_MS,
  SCORE_MAX_REDIRECTS,
} from "./limits";
import {
  assertSafeLiveUrl,
  isBlockedHost,
  isPrivateIp,
  UnsafeUrlError,
} from "./ssrf";

export const SCORE_USER_AGENT =
  "AgentReadyBot/0.3 (+https://github.com/dayniia/AgentReady)";

export type LookupFn = (
  hostname: string,
) => Promise<{ address: string; family: number }[]>;

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export type FetchedDoc = {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
  truncated?: boolean;
  fetchError?: string;
};

export type LiveFetchOptions = {
  fetch?: FetchLike;
  lookup?: LookupFn;
  fallbackLookup?: LookupFn;
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
};

export async function fetchSafeHttps(
  input: string,
  options: LiveFetchOptions = {},
): Promise<FetchedDoc> {
  const requestedUrl = assertSafeLiveUrl(input).href;
  let current = assertSafeLiveUrl(input);
  const timeoutMs = options.timeoutMs ?? SCORE_FETCH_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? SCORE_MAX_REDIRECTS;
  const maxBytes = options.maxBytes ?? MAX_SCORE_BODY_BYTES;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const addresses = await publicAddressesFor(current.hostname, options);
    const response = options.fetch
      ? await options.fetch(current.href, {
          method: "GET",
          redirect: "manual",
          headers: {
            Accept:
              "text/html,application/xhtml+xml,application/json,text/plain,application/xml,text/xml,*/*",
            "User-Agent": SCORE_USER_AGENT,
          },
          signal: AbortSignal.timeout(timeoutMs),
        })
      : await httpsGetViaIps(current, addresses, timeoutMs, maxBytes);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(`Redirect from ${current.href} had no Location header`);
      }
      current = assertSafeLiveUrl(new URL(location, current).href);
      continue;
    }

    const captured = options.fetch
      ? await readBodyCapped(response, maxBytes)
      : {
          body: await response.text(),
          truncated: response.headers.get("x-agentready-truncated") === "1",
        };
    return {
      requestedUrl,
      finalUrl: current.href,
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      body: captured.body,
      truncated: captured.truncated,
    };
  }

  throw new Error(`Too many redirects fetching ${requestedUrl}`);
}

export async function publicAddressesFor(
  hostname: string,
  options: Pick<LiveFetchOptions, "lookup" | "fallbackLookup"> = {},
): Promise<string[]> {
  const records = await resolveHostAddresses(hostname, options);
  if (records.length === 0) {
    throw new Error(`Could not resolve ${hostname}`);
  }
  const usable: string[] = [];
  for (const record of records) {
    const address = record.address.toLowerCase();
    if (isPrivateIp(address) || isBlockedHost(address)) {
      throw new UnsafeUrlError("Resolved address is private or blocked");
    }
    usable.push(record.address);
  }
  const ipv4 = usable.filter((address) => !address.includes(":"));
  return ipv4.length > 0 ? ipv4 : usable;
}

const RESOLVE_CACHE_MS = 30_000;
const resolveCache = new Map<
  string,
  { at: number; records: { address: string; family: number }[] }
>();

export async function resolveHostAddresses(
  hostname: string,
  options: Pick<LiveFetchOptions, "lookup" | "fallbackLookup"> = {},
): Promise<{ address: string; family: number }[]> {
  const useCache = !options.lookup && !options.fallbackLookup;
  if (useCache) {
    const hit = resolveCache.get(hostname);
    if (hit && Date.now() - hit.at < RESOLVE_CACHE_MS) {
      return hit.records;
    }
  }

  let records: { address: string; family: number }[] = [];
  if (options.lookup) {
    try {
      records = await options.lookup(hostname);
    } catch {
      // tests inject failing system DNS
    }
  }
  if (records.length === 0 && options.fallbackLookup) {
    records = await options.fallbackLookup(hostname);
  }
  if (records.length === 0 && !options.lookup && !options.fallbackLookup) {
    // DoH first: Node getaddrinfo hangs on this network and saturates the UV threadpool,
    // which then makes HTTPS (including DoH) time out too.
    try {
      records = await dohLookup(hostname);
    } catch {
      records = [];
    }
    if (records.length === 0) {
      try {
        records = await windowsLookup(hostname);
      } catch {
        records = [];
      }
    }
    if (records.length === 0) {
      throw new Error(
        `Could not resolve ${hostname} (HTTPS DNS timed out; this network is blocking system DNS)`,
      );
    }
  }
  if (records.length === 0) {
    throw new Error(`Could not resolve ${hostname}`);
  }
  if (useCache) {
    resolveCache.set(hostname, { at: Date.now(), records });
  }
  return records;
}

export function parseDohAnswers(
  json: unknown,
): { address: string; family: number }[] {
  if (!json || typeof json !== "object") return [];
  const answers = (json as { Answer?: { type?: number; data?: string }[] })
    .Answer;
  if (!Array.isArray(answers)) return [];
  const records: { address: string; family: number }[] = [];
  for (const answer of answers) {
    if (answer?.type === 1 && typeof answer.data === "string") {
      records.push({ address: answer.data, family: 4 });
    }
    if (answer?.type === 28 && typeof answer.data === "string") {
      records.push({ address: answer.data, family: 6 });
    }
  }
  return records;
}

const DOH_ENDPOINTS = [
  {
    ip: "8.8.8.8",
    sni: "dns.google",
    path: (host: string) => `/resolve?name=${encodeURIComponent(host)}&type=A`,
  },
  {
    ip: "8.8.4.4",
    sni: "dns.google",
    path: (host: string) => `/resolve?name=${encodeURIComponent(host)}&type=A`,
  },
  {
    ip: "1.1.1.1",
    sni: "cloudflare-dns.com",
    path: (host: string) => `/dns-query?name=${encodeURIComponent(host)}&type=A`,
  },
  {
    ip: "1.0.0.1",
    sni: "cloudflare-dns.com",
    path: (host: string) => `/dns-query?name=${encodeURIComponent(host)}&type=A`,
  },
  {
    ip: "9.9.9.9",
    sni: "dns.quad9.net",
    path: (host: string) => `/dns-query?name=${encodeURIComponent(host)}&type=A`,
  },
] as const;

async function dohLookup(
  hostname: string,
): Promise<{ address: string; family: number }[]> {
  const attempts = DOH_ENDPOINTS.map(async (endpoint) => {
    const json = await httpsJsonViaIp(
      endpoint.ip,
      endpoint.sni,
      endpoint.path(hostname),
      5_000,
    );
    const records = parseDohAnswers(json);
    if (records.length === 0) {
      throw new Error(`${endpoint.sni} returned no A records`);
    }
    return records;
  });
  try {
    return await Promise.any(attempts);
  } catch (error) {
    const detail =
      error instanceof AggregateError && error.errors[0] instanceof Error
        ? error.errors[0].message
        : "all DNS-over-HTTPS endpoints failed";
    throw new Error(detail);
  }
}

async function windowsLookup(
  hostname: string,
): Promise<{ address: string; family: number }[]> {
  if (process.platform !== "win32" || !/^[a-z0-9.-]+$/i.test(hostname)) {
    return [];
  }
  const { stdout } = await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Resolve-DnsName -Name '${hostname}' -Type A -ErrorAction Stop | Select-Object -ExpandProperty IPAddress`,
    ],
    { timeout: 4000, windowsHide: true },
  );
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(line))
    .map((address) => ({ address, family: 4 }));
}

async function httpsGetViaIps(
  target: URL,
  ips: string[],
  timeoutMs: number,
  maxBytes: number,
): Promise<Response> {
  let lastError: unknown;
  for (const ip of ips) {
    try {
      return await httpsGetViaIp(target, ip, timeoutMs, maxBytes);
    } catch (error) {
      lastError = error;
    }
  }
  const detail = lastError instanceof Error ? lastError.message : "connect failed";
  throw new Error(`Could not fetch ${target.href} (${detail})`);
}

function httpsGetViaIp(
  target: URL,
  ip: string,
  timeoutMs: number,
  maxBytes: number,
): Promise<Response> {
  return httpsRequest(
    {
      hostname: ip,
      servername: target.hostname,
      path: `${target.pathname}${target.search}`,
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/json,text/plain,application/xml,text/xml,*/*",
        Host: target.host,
        "User-Agent": SCORE_USER_AGENT,
      },
    },
    timeoutMs,
    maxBytes,
  );
}

function httpsJsonViaIp(
  ip: string,
  sni: string,
  path: string,
  timeoutMs: number,
): Promise<unknown> {
  return httpsRequest(
    {
      hostname: ip,
      servername: sni,
      path,
      headers: {
        Accept: "application/dns-json, application/json",
        Host: sni,
        "User-Agent": SCORE_USER_AGENT,
      },
    },
    timeoutMs,
    64 * 1024,
  ).then(async (response) => {
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`DNS-over-HTTPS failed (${response.status})`);
    }
    return JSON.parse(await response.text()) as unknown;
  });
}

function httpsRequest(
  options: {
    hostname: string;
    servername: string;
    path: string;
    headers: Record<string, string>;
  },
  timeoutMs: number,
  maxBytes: number,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let killer: ReturnType<typeof setTimeout> | undefined;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (killer) clearTimeout(killer);
      fn();
    };
    const req = https.request(
      {
        hostname: options.hostname,
        port: 443,
        servername: options.servername,
        path: options.path,
        method: "GET",
        family: 4,
        agent: httpsAgent,
        rejectUnauthorized: true,
        headers: options.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let total = 0;
        res.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > maxBytes) {
            chunks.push(chunk.subarray(0, Math.max(0, maxBytes - (total - chunk.length))));
            req.destroy();
            finish(() =>
              resolve(
                responseFromChunks(chunks, res, {
                  "x-agentready-truncated": "1",
                }),
              ),
            );
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          finish(() => resolve(responseFromChunks(chunks, res)));
        });
      },
    );
    killer = setTimeout(() => {
      req.destroy();
      finish(() =>
        reject(new Error(`Timeout contacting ${options.servername}`)),
      );
    }, timeoutMs);
    req.on("error", (error) => {
      finish(() => reject(error));
    });
    req.end();
  });
}

async function readBodyCapped(
  response: Response,
  maxBytes: number,
): Promise<{ body: string; truncated: boolean }> {
  const buffer = new Uint8Array(await response.arrayBuffer());
  if (buffer.byteLength > maxBytes) {
    return {
      body: new TextDecoder("utf-8").decode(buffer.slice(0, maxBytes)),
      truncated: true,
    };
  }
  return {
    body: new TextDecoder("utf-8").decode(buffer),
    truncated: false,
  };
}

function responseFromChunks(
  chunks: Buffer[],
  res: { statusCode?: number; headers: IncomingHttpHeaders },
  extra: Record<string, string> = {},
): Response {
  const headers = new Headers();
  for (const [key, value] of Object.entries(res.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(", "));
  }
  for (const [key, value] of Object.entries(extra)) {
    headers.set(key, value);
  }
  return new Response(Buffer.concat(chunks).toString("utf8"), {
    status: res.statusCode ?? 0,
    headers,
  });
}
