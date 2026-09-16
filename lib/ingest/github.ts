import JSZip from "jszip";
import { isRouteFile, normalizePath } from "@/lib/core/extractors/nextjs";
import type { SourceFile } from "@/lib/core/types";
import {
  assertSafeDownloadUrl,
  parseGitHubRepoUrl,
  type GitHubRepoRef,
  UnsafeUrlError,
} from "./ssrf";

export { parseGitHubRepoUrl, UnsafeUrlError };
export type { GitHubRepoRef };

export const MAX_ZIP_BYTES = 20 * 1024 * 1024;
export const MAX_ROUTE_FILE_BYTES = 512 * 1024;

type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string>; redirect?: RequestRedirect },
) => Promise<Response>;

type IngestOptions = {
  token?: string;
  fetch?: FetchLike;
};

export async function ingestGitHubRepo(
  githubUrl: string,
  options: IngestOptions = {},
): Promise<{ repo: GitHubRepoRef; files: SourceFile[] }> {
  const repo = parseGitHubRepoUrl(githubUrl);
  const zip = await downloadZipball(repo, options);
  return { repo, files: await routeFilesFromZip(zip) };
}

export async function routeFilesFromZip(
  buffer: ArrayBuffer,
): Promise<SourceFile[]> {
  if (buffer.byteLength > MAX_ZIP_BYTES) {
    throw new UnsafeUrlError("Repository archive exceeds the 20MB limit");
  }

  const zip = await JSZip.loadAsync(buffer);
  const files: SourceFile[] = [];

  for (const [entryName, entry] of Object.entries(zip.files)) {
    if (entry.dir) {
      continue;
    }
    const relative = stripZipRoot(entryName);
    const filePath = normalizePath(relative);
    if (!isRouteFile(filePath)) {
      continue;
    }

    const content = await entry.async("string");
    if (new TextEncoder().encode(content).length > MAX_ROUTE_FILE_BYTES) {
      continue;
    }

    files.push({ filePath, content });
  }

  return files;
}

async function downloadZipball(
  repo: GitHubRepoRef,
  options: IngestOptions,
): Promise<ArrayBuffer> {
  const fetchImpl = options.fetch ?? fetch;
  const url = zipballUrl(repo);
  assertSafeDownloadUrl(url);

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "agent-ready",
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetchImpl(url, { headers, redirect: "follow" });
  if (response.url) {
    assertSafeDownloadUrl(response.url);
  }
  if (!response.ok) {
    throw new Error(
      `GitHub zipball request failed (${response.status} ${response.statusText})`,
    );
  }

  const length = response.headers.get("content-length");
  if (length && Number(length) > MAX_ZIP_BYTES) {
    throw new UnsafeUrlError("Repository archive exceeds the 20MB limit");
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_ZIP_BYTES) {
    throw new UnsafeUrlError("Repository archive exceeds the 20MB limit");
  }
  return buffer;
}

function zipballUrl(repo: GitHubRepoRef): string {
  const base = `https://api.github.com/repos/${repo.owner}/${repo.repo}/zipball`;
  return repo.ref ? `${base}/${encodeURIComponent(repo.ref)}` : base;
}

function stripZipRoot(entryName: string): string {
  const normalized = normalizePath(entryName);
  const slash = normalized.indexOf("/");
  return slash === -1 ? normalized : normalized.slice(slash + 1);
}
