export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export type GitHubRepoRef = {
  owner: string;
  repo: string;
  ref?: string;
};

const OWNER_REPO_RE = /^[A-Za-z0-9._-]+$/;
const SHORT_REPO_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+(?:\.git)?$/;
const ALLOWED_PAGE_HOSTS = new Set(["github.com", "www.github.com"]);
const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "169.254.169.254",
  "metadata.google.internal",
]);

export function parseGitHubRepoUrl(input: string): GitHubRepoRef {
  const parsed = parseHttpsGitHubUrl(normalizeGitHubInput(input));

  if (parsed.protocol !== "https:") {
    throw new UnsafeUrlError("Only HTTPS GitHub URLs are allowed");
  }

  if (parsed.username || parsed.password) {
    throw new UnsafeUrlError("URLs with credentials are not allowed");
  }

  const host = parsed.hostname.toLowerCase();
  if (isBlockedHost(host)) {
    throw new UnsafeUrlError("Private or metadata hosts are not allowed");
  }

  if (!ALLOWED_PAGE_HOSTS.has(host)) {
    throw new UnsafeUrlError("Only github.com URLs are allowed");
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new UnsafeUrlError("URL must be https://github.com/owner/repo");
  }

  const owner = decodeURIComponent(parts[0] ?? "");
  const repo = decodeURIComponent(parts[1] ?? "").replace(/\.git$/i, "");
  if (!isSafeName(owner) || !isSafeName(repo)) {
    throw new UnsafeUrlError("Invalid owner or repo name");
  }

  let ref: string | undefined;
  if (parts[2] === "tree" && parts[3]) {
    ref = decodeURIComponent(parts.slice(3).join("/"));
    if (ref.startsWith("refs/heads/")) {
      ref = ref.slice("refs/heads/".length);
    }
  } else if (parts[2] === "blob" && parts[3]) {
    ref = decodeURIComponent(parts[3]);
  }

  return { owner, repo, ref };
}

export function githubCloneUrl(repo: GitHubRepoRef): string {
  return `https://github.com/${repo.owner}/${repo.repo}.git`;
}

export function assertSafeDownloadUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UnsafeUrlError("Invalid download URL");
  }

  if (parsed.protocol !== "https:") {
    throw new UnsafeUrlError("Download URL must be HTTPS");
  }

  const host = parsed.hostname.toLowerCase();
  if (
    isBlockedHost(host) ||
    (host !== "api.github.com" && host !== "codeload.github.com")
  ) {
    throw new UnsafeUrlError("Download host is not allowlisted");
  }

  return parsed;
}

export function normalizeGitHubInput(raw: string): string {
  let value = raw.trim().replace(/^\uFEFF/, "").replace(/\u00a0/g, " ").trim();
  value = value.replace(/^['"`<(\[]+/, "").replace(/['"`>)\]]+$/g, "");
  value = value.replace(/[.,;]+$/g, "").trim();
  if (SHORT_REPO_RE.test(value)) {
    return `https://github.com/${value.replace(/\.git$/i, "")}`;
  }
  return value;
}

function parseHttpsGitHubUrl(value: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new UnsafeUrlError(
      "Invalid URL — use https://github.com/owner/repo or owner/repo",
    );
  }
}

function isSafeName(value: string): boolean {
  return OWNER_REPO_RE.test(value) && value !== "." && value !== "..";
}

const MAX_LIVE_URL_LENGTH = 2048;

export function assertSafeLiveUrl(input: string): URL {
  const trimmed = input.trim().replace(/^\uFEFF/, "").replace(/\u00a0/g, " ").trim();
  if (!trimmed) {
    throw new UnsafeUrlError("URL is required");
  }
  if (trimmed.length > MAX_LIVE_URL_LENGTH) {
    throw new UnsafeUrlError("URL is too long");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new UnsafeUrlError("Invalid URL — use an https:// address");
  }

  parsed.hash = "";

  if (parsed.protocol !== "https:") {
    throw new UnsafeUrlError("Only HTTPS URLs are allowed");
  }
  if (parsed.username || parsed.password) {
    throw new UnsafeUrlError("URLs with credentials are not allowed");
  }
  if (parsed.port && parsed.port !== "443") {
    throw new UnsafeUrlError("Only HTTPS port 443 is allowed");
  }

  const host = parsed.hostname.toLowerCase();
  if (isBlockedHost(host) || isPrivateNetworkHost(host)) {
    throw new UnsafeUrlError("Private or metadata hosts are not allowed");
  }

  return parsed;
}

export function isBlockedHost(host: string): boolean {
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost")) {
    return true;
  }
  return isPrivateIp(host);
}

function isPrivateNetworkHost(host: string): boolean {
  return (
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan") ||
    host.endsWith(".home")
  );
}

export function isPrivateIp(host: string): boolean {
  const value = host.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
  if (isPrivateIPv4(value)) {
    return true;
  }
  if (value.includes(":")) {
    if (value === "::1" || value === "0:0:0:0:0:0:0:1") {
      return true;
    }
    if (
      value.startsWith("fe80:") ||
      value.startsWith("fc") ||
      value.startsWith("fd")
    ) {
      return true;
    }
  }
  const mapped = value.match(/^:?ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped?.[1]) {
    return isPrivateIPv4(mapped[1]);
  }
  return false;
}

function isPrivateIPv4(host: string): boolean {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) {
    return false;
  }
  const octets = match.slice(1, 5).map(Number);
  if (octets.some((octet) => octet > 255)) {
    return false;
  }
  const [a, b] = octets;
  if (a === 10 || a === 127 || a === 0) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  return false;
}
