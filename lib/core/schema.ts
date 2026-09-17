import { z } from "zod";

export const parameterSchema = z.object({
  name: z.string().min(1),
  in: z.enum(["path", "query", "body"]),
  required: z.boolean(),
});

export const classificationSchema = z.object({
  action_name: z.string().min(1).max(80),
  description: z.string().min(1).max(500),
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
  let value = input;
  if (typeof value === "string") {
    try {
      const fenced = value.trim().match(/```(?:json)?\s*([\s\S]*?)```/i);
      value = JSON.parse((fenced?.[1] ?? value).trim()) as unknown;
    } catch {
      return null;
    }
  }
  if (value && typeof value === "object") {
    const record = { ...(value as Record<string, unknown>) };
    if (typeof record.action_type === "string") {
      record.action_type = record.action_type.toLowerCase();
    }
    const parsed = classificationSchema.safeParse(record);
    return parsed.success ? parsed.data : null;
  }
  const parsed = classificationSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
