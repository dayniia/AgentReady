import { createHash } from "node:crypto";
import type { HttpMethod, Parameter, Route, SourceFile } from "./types";

const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const satisfies readonly HttpMethod[];

const METHOD_SET = new Set<string>(HTTP_METHODS);

const APP_ROUTE_RE = /(^|\/)app\/api\/.+\/route\.(ts|js|tsx|jsx)$/;
const PAGES_API_RE = /(^|\/)pages\/api\/.+\.(ts|js|tsx|jsx)$/;

export function extractNextJsRoutes(files: SourceFile[]): Route[] {
  const routes: Route[] = [];

  for (const file of files) {
    const filePath = normalizePath(file.filePath);
    if (!isRouteFile(filePath) || shouldSkip(filePath)) {
      continue;
    }

    const path = toUrlPath(filePath);
    if (!path) {
      continue;
    }

    const methods = detectMethods(filePath, file.content);
    if (methods.length === 0) {
      continue;
    }

    const params = [
      ...pathParams(path),
      ...queryParams(file.content),
      ...bodyParams(file.content),
    ];
    const sourceHash = hashSource(file.content);

    for (const method of methods) {
      routes.push({
        filePath,
        method,
        path,
        params: paramsForMethod(method, params),
        sourceHash,
      });
    }
  }

  return routes.sort(compareRoutes);
}

export function isRouteFile(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  return APP_ROUTE_RE.test(normalized) || PAGES_API_RE.test(normalized);
}

export function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "");
}

function shouldSkip(filePath: string): boolean {
  return (
    filePath.includes("/node_modules/") ||
    /(^|\/)\.env/.test(filePath) ||
    filePath.endsWith(".d.ts")
  );
}

function toUrlPath(filePath: string): string | null {
  const appIndex = filePath.lastIndexOf("/app/api/");
  const appAtRoot = filePath.startsWith("app/api/");
  if (appIndex !== -1 || appAtRoot) {
    const fromApp = appAtRoot
      ? filePath
      : filePath.slice(appIndex + 1);
    const withoutFile = fromApp.replace(/\/route\.(ts|js|tsx|jsx)$/, "");
    const withoutApp = withoutFile.replace(/^app/, "");
    const withoutGroups = withoutApp
      .split("/")
      .filter((segment) => segment.length > 0 && !/^\(.*\)$/.test(segment))
      .join("/");
    return `/${withoutGroups}`;
  }

  const pagesIndex = filePath.lastIndexOf("/pages/api/");
  const pagesAtRoot = filePath.startsWith("pages/api/");
  if (pagesIndex !== -1 || pagesAtRoot) {
    const fromPages = pagesAtRoot
      ? filePath
      : filePath.slice(pagesIndex + 1);
    const withoutFile = fromPages.replace(/\.(ts|js|tsx|jsx)$/, "");
    const withoutPages = withoutFile.replace(/^pages/, "");
    return `/${withoutPages.replace(/^\//, "")}`;
  }

  return null;
}

function detectMethods(filePath: string, content: string): HttpMethod[] {
  if (APP_ROUTE_RE.test(filePath)) {
    return uniqueMethods([
      ...matchNamedExports(content),
      ...matchExportList(content),
    ]);
  }

  const fromReq = matchPagesMethods(content);
  return fromReq.length > 0 ? uniqueMethods(fromReq) : ["GET"];
}

function matchNamedExports(content: string): HttpMethod[] {
  const found: HttpMethod[] = [];
  const functionExport =
    /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g;
  const constExport =
    /export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*=/g;

  for (const re of [functionExport, constExport]) {
    for (const match of content.matchAll(re)) {
      found.push(match[1] as HttpMethod);
    }
  }

  return found;
}

function matchExportList(content: string): HttpMethod[] {
  const found: HttpMethod[] = [];
  const listExport = /export\s*\{([^}]+)\}/g;

  for (const match of content.matchAll(listExport)) {
    const names = match[1].split(",").map((part) => {
      const tokens = part.trim().split(/\s+as\s+/);
      return (tokens[1] ?? tokens[0]).trim();
    });
    for (const name of names) {
      if (METHOD_SET.has(name)) {
        found.push(name as HttpMethod);
      }
    }
  }

  return found;
}

function matchPagesMethods(content: string): HttpMethod[] {
  const found: HttpMethod[] = [];
  const re =
    /req\.method\s*===?\s*['"](GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)['"]/g;
  for (const match of content.matchAll(re)) {
    found.push(match[1] as HttpMethod);
  }
  return found;
}

function pathParams(path: string): Parameter[] {
  const params: Parameter[] = [];
  for (const segment of path.split("/")) {
    const optionalCatchAll = segment.match(/^\[\[\.\.\.(.+)\]\]$/);
    if (optionalCatchAll) {
      params.push({
        name: optionalCatchAll[1],
        in: "path",
        required: false,
      });
      continue;
    }
    const catchAll = segment.match(/^\[\.\.\.(.+)\]$/);
    if (catchAll) {
      params.push({ name: catchAll[1], in: "path", required: true });
      continue;
    }
    const dynamic = segment.match(/^\[(.+)\]$/);
    if (dynamic) {
      params.push({ name: dynamic[1], in: "path", required: true });
    }
  }
  return params;
}

function queryParams(content: string): Parameter[] {
  const names = new Set<string>();
  const re =
    /(?:searchParams|url\.searchParams)\.get\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of content.matchAll(re)) {
    names.add(match[1]);
  }
  return [...names].map((name) => ({
    name,
    in: "query" as const,
    required: false,
  }));
}

function bodyParams(content: string): Parameter[] {
  const names = new Set<string>();
  const re =
    /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*await\s+(?:request|req)\.json\(\s*\)/g;
  for (const match of content.matchAll(re)) {
    for (const part of match[1].split(",")) {
      const name = part.trim().split(":")[0]?.trim();
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) {
        names.add(name);
      }
    }
  }
  return [...names].map((name) => ({
    name,
    in: "body" as const,
    required: false,
  }));
}

function paramsForMethod(method: HttpMethod, params: Parameter[]): Parameter[] {
  if (method === "GET" || method === "HEAD") {
    return params.filter((param) => param.in !== "body");
  }
  return params;
}

function hashSource(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function uniqueMethods(methods: HttpMethod[]): HttpMethod[] {
  return HTTP_METHODS.filter((method) => methods.includes(method));
}

function compareRoutes(a: Route, b: Route): number {
  return a.path.localeCompare(b.path) || a.method.localeCompare(b.method);
}
