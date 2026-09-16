import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import JSZip from "jszip";
import { isRouteFile, normalizePath } from "@/lib/core/extractors/nextjs";
import type { SourceFile } from "@/lib/core/types";
import { readRouteFilesFromDirectory } from "./files";
import { MAX_ROUTE_FILE_BYTES, MAX_ZIP_BYTES } from "./limits";
import {
  assertSafeDownloadUrl,
  githubCloneUrl,
  parseGitHubRepoUrl,
  type GitHubRepoRef,
  UnsafeUrlError,
} from "./ssrf";

export { parseGitHubRepoUrl, UnsafeUrlError, MAX_ZIP_BYTES, MAX_ROUTE_FILE_BYTES };
export type { GitHubRepoRef };

const execFileAsync = promisify(execFile);

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
  try {
    const zip = await downloadZipball(repo, options);
    return { repo, files: await routeFilesFromZip(zip) };
  } catch (error) {
    if (options.fetch || !isNetworkFailure(error)) {
      throw wrapNetworkError(error);
    }
    const files = await cloneWithGit(repo);
    return { repo, files };
  }
}

export async function ingestWorkspace(
  root = process.cwd(),
): Promise<{ repo: GitHubRepoRef; files: SourceFile[] }> {
  return {
    repo: { owner: "local", repo: path.basename(root) },
    files: readRouteFilesFromDirectory(root),
  };
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

async function cloneWithGit(repo: GitHubRepoRef): Promise<SourceFile[]> {
  const dir = await mkdtemp(path.join(tmpdir(), "agent-ready-"));
  const args = ["clone", "--depth", "1", "--single-branch"];
  if (repo.ref) {
    args.push("--branch", repo.ref);
  }
  args.push(githubCloneUrl(repo), dir);

  try {
    await execFileAsync("git", args, {
      timeout: 90_000,
      windowsHide: true,
    });
    return readRouteFilesFromDirectory(dir);
  } catch (error) {
    throw new Error(
      `Could not fetch ${repo.owner}/${repo.repo} from GitHub. ${describeError(error)}`,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function zipballUrl(repo: GitHubRepoRef): string {
  const base = `https://api.github.com/repos/${repo.owner}/${repo.repo}/zipball`;
  if (!repo.ref) {
    return base;
  }
  const encodedRef = repo.ref
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}/${encodedRef}`;
}

function stripZipRoot(entryName: string): string {
  const normalized = normalizePath(entryName);
  const slash = normalized.indexOf("/");
  return slash === -1 ? normalized : normalized.slice(slash + 1);
}

function isNetworkFailure(error: unknown): boolean {
  const text = describeError(error);
  return /fetch failed|timeout|Connect Timeout|ECONNRESET|ENOTFOUND|ETIMEDOUT|network/i.test(
    text,
  );
}

function wrapNetworkError(error: unknown): Error {
  if (error instanceof UnsafeUrlError) {
    return error;
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error(describeError(error));
}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const cause =
    error.cause instanceof Error ? error.cause.message : undefined;
  return cause ? `${error.message}: ${cause}` : error.message;
}
