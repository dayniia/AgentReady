import { z } from "zod";

const ACTION_ALIASES: Record<string, ClassificationFields["action_type"]> = {
  read: "read",
  get: "read",
  list: "read",
  fetch: "read",
  create: "create",
  add: "create",
  post: "create",
  update: "update",
  patch: "update",
  put: "update",
  edit: "update",
  delete: "delete",
  remove: "delete",
  destroy: "delete",
  search: "search",
  query: "search",
  find: "search",
  other: "other",
};

const LOCATION_ALIASES: Record<string, "path" | "query" | "body"> = {
  path: "path",
  params: "path",
  param: "path",
  query: "query",
  qs: "query",
  body: "body",
};

export const parameterSchema = z.object({
  name: z.string().min(1),
  in: z.enum(["path", "query", "body"]),
  required: z.boolean(),
});

export const classificationSchema = z.object({
  action_name: z.string().min(1).max(120),
  description: z.string().min(1).max(800),
  action_type: z.enum([
    "read",
    "create",
    "update",
    "delete",
    "search",
    "other",
  ]),
  parameters: z.array(parameterSchema).optional(),
});

export type ClassificationFields = z.infer<typeof classificationSchema>;

export function parseClassification(input: unknown): ClassificationFields | null {
  const value = coerceClassification(input);
  if (!value) {
    return null;
  }
  const parsed = classificationSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseClassificationBatch(
  input: unknown,
): { method: string; path: string; fields: ClassificationFields }[] {
  const rows = unwrapBatch(input);
  const results: { method: string; path: string; fields: ClassificationFields }[] =
    [];
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const record = row as Record<string, unknown>;
    const method = String(record.method ?? "").toUpperCase();
    const path = String(record.path ?? "");
    const fields = parseClassification(record);
    if (method && path && fields) {
      results.push({ method, path, fields });
    }
  }
  return results;
}

function unwrapBatch(input: unknown): unknown[] {
  const value = typeof input === "string" ? parseJsonish(input) : input;
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.classifications)) {
      return record.classifications;
    }
    if (Array.isArray(record.routes)) {
      return record.routes;
    }
  }
  return [];
}

function coerceClassification(input: unknown): Record<string, unknown> | null {
  let value: unknown = input;
  if (typeof input === "string") {
    try {
      value = parseJsonish(input);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = { ...(value as Record<string, unknown>) };
  if (typeof record.action_type === "string") {
    const alias = ACTION_ALIASES[record.action_type.toLowerCase().trim()];
    if (alias) {
      record.action_type = alias;
    }
  }
  if (typeof record.action_name === "string") {
    record.action_name = record.action_name.trim().slice(0, 120);
  }
  if (typeof record.description === "string") {
    record.description = record.description.trim().slice(0, 800);
  }
  if (Array.isArray(record.parameters)) {
    record.parameters = record.parameters
      .map((param) => coerceParameter(param))
      .filter((param): param is Record<string, unknown> => param !== null);
  }
  return record;
}

function coerceParameter(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const record = { ...(input as Record<string, unknown>) };
  if (typeof record.in === "string") {
    const alias = LOCATION_ALIASES[record.in.toLowerCase().trim()];
    if (alias) {
      record.in = alias;
    }
  }
  if (typeof record.required !== "boolean") {
    record.required = false;
  }
  return record;
}

function parseJsonish(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse((fenced?.[1] ?? trimmed).trim()) as unknown;
}
