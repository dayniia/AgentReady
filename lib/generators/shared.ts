import type { ClassifiedRoute, Parameter } from "@/lib/core";

const SKIP_METHODS = new Set(["HEAD", "OPTIONS"]);

export type GeneratedFile = {
  filename: string;
  content: string;
};

export type GenerateOptions = {
  title: string;
  description?: string;
};

export function actionableRoutes(routes: ClassifiedRoute[]): ClassifiedRoute[] {
  return routes.filter((route) => !SKIP_METHODS.has(route.method));
}

export function uniqueToolName(
  route: ClassifiedRoute,
  used: Set<string>,
): string {
  const candidates = [
    slug(route.action_name),
    slug(`${route.method}_${route.action_name}`),
    slug(`${route.method}_${route.path}`),
  ];
  for (const candidate of candidates) {
    if (candidate && !used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  let index = 2;
  const base = slug(route.action_name) || "action";
  while (used.has(`${base}_${index}`)) {
    index += 1;
  }
  const name = `${base}_${index}`;
  used.add(name);
  return name;
}

export function parameterLines(params: Parameter[]): string {
  if (params.length === 0) {
    return "";
  }
  return params
    .map((param) => `${param.name} (${param.in}${param.required ? ", required" : ""})`)
    .join(", ");
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^\w]+/g, "_")
    .replaceAll(/^_+|_+$/g, "")
    .slice(0, 64);
}
