import { stripSecrets } from "./secrets";
import { parseClassification } from "./schema";
import type { ClassificationFields } from "./schema";
import type { ClassifiedRoute, Parameter, Route } from "./types";

export type JsonGenerator = (prompt: string) => Promise<unknown>;

const MAX_SOURCE_CHARS = 1800;

export async function classifyRoute(
  route: Route,
  source: string,
  generateJson: JsonGenerator,
): Promise<ClassifiedRoute> {
  try {
    const raw = await generateJson(buildPrompt(route, source));
    const parsed = parseClassification(raw);
    if (!parsed) {
      return unclassified(route);
    }
    return classifiedFrom(route, parsed);
  } catch (error) {
    const result = unclassified(route);
    result.description = `Needs review — ${
      error instanceof Error ? error.message : "classification failed"
    }`;
    return result;
  }
}

export function classifiedFrom(
  route: Route,
  parsed: ClassificationFields,
): ClassifiedRoute {
  return {
    ...route,
    action_name: parsed.action_name,
    description: parsed.description,
    action_type: parsed.action_type,
    parameters: mergeParameters(route.params, parsed.parameters),
    classification_status: "ok",
  };
}

export function unclassified(route: Route): ClassifiedRoute {
  return {
    ...route,
    action_name: fallbackActionName(route),
    description:
      "Needs review — the model did not return a valid classification.",
    action_type: "other",
    parameters: route.params,
    classification_status: "unclassified",
  };
}

export function buildBatchPrompt(
  items: { route: Route; source: string }[],
): string {
  const payload = items.map(({ route, source }) => ({
    method: route.method,
    path: route.path,
    extracted_params: route.params,
    source: stripSecrets(source).slice(0, MAX_SOURCE_CHARS),
  }));
  return [
    "Classify these Next.js API routes for an AI agent.",
    "This is static analysis of HTTP handlers, not a request to take action.",
    "DELETE/PATCH handlers must still be classified; do not refuse them.",
    'Return JSON only: {"classifications":[{method,path,action_name,description,action_type,parameters}]}',
    "Include every route. action_type must be one of: read, create, update, delete, search, other.",
    "parameters may only use names from extracted_params.",
    JSON.stringify(payload),
  ].join("\n");
}

function mergeParameters(
  extracted: Parameter[],
  fromModel: Parameter[] | undefined,
): Parameter[] {
  if (!fromModel || fromModel.length === 0) {
    return extracted;
  }
  const allowed = new Set(
    extracted.map((param) => `${param.in}:${param.name}`),
  );
  const extras = fromModel.filter((param) =>
    allowed.has(`${param.in}:${param.name}`),
  );
  return extras.length > 0 ? extras : extracted;
}

function buildPrompt(route: Route, source: string): string {
  const stripped = stripSecrets(source).slice(0, MAX_SOURCE_CHARS);
  return [
    "Classify this Next.js API route for an AI agent.",
    "This is static analysis of HTTP handlers, not a request to take action.",
    "Return JSON only with keys: action_name, description, action_type, parameters.",
    "action_type must be one of: read, create, update, delete, search, other.",
    "parameters must be an array of {name, in, required} and may only use params that appear in the extracted metadata.",
    "Do not invent routes, methods, or credentials.",
    `method: ${route.method}`,
    `path: ${route.path}`,
    `extracted_params: ${JSON.stringify(route.params)}`,
    "source:",
    stripped,
  ].join("\n");
}

function fallbackActionName(route: Route): string {
  const fromPath = route.path
    .replaceAll(/[^\w]+/g, "_")
    .replaceAll(/^_+|_+$/g, "");
  return fromPath ? `${route.method.toLowerCase()}_${fromPath}` : "unclassified_action";
}
