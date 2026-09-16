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
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }

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

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, "");
  if (
    !OWNER_REPO_RE.test(owner) ||
    !OWNER_REPO_RE.test(repo) ||
    owner === "." ||
    owner === ".." ||
    repo === "." ||
    repo === ".."
  ) {
    throw new UnsafeUrlError("Invalid owner or repo name");
  }

  let ref: string | undefined;
  if (parts[2] === "tree" && parts[3]) {
    ref = decodeURIComponent(parts.slice(3).join("/"));
  } else if (parts[2] === "blob" && parts[3]) {
    ref = decodeURIComponent(parts[3]);
  }

  return { owner, repo, ref };
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

function isBlockedHost(host: string): boolean {
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost")) {
    return true;
  }
  return isPrivateIPv4(host);
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
