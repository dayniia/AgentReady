import { stripSecrets } from "./secrets";
import { DEFAULT_GEMINI_MODEL } from "./models";

export type GeminiGenerateOptions = {
  apiKey: string;
  model?: string;
  fetch?: typeof fetch;
};

export function createGeminiJsonGenerator(
  options: GeminiGenerateOptions,
): (prompt: string) => Promise<unknown> {
  const model =
    options.model?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_GEMINI_MODEL;
  const fetchImpl = options.fetch ?? fetch;

  return async (prompt: string) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": options.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: stripSecrets(prompt) }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Gemini request failed (${response.status} ${model}): ${detail.slice(0, 400)}`,
      );
    }

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Gemini returned an empty response");
    }
    return parseModelJson(text);
  };
}

export function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? trimmed).trim();
  return JSON.parse(raw) as unknown;
}
