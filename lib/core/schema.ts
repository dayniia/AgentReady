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
  const parsed = classificationSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}
