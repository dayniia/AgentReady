import { stripSecrets } from "./secrets";

export type GeminiGenerateOptions = {
  apiKey: string;
  model?: string;
  fetch?: typeof fetch;
};

export function createGeminiJsonGenerator(
  options: GeminiGenerateOptions,
): (prompt: string) => Promise<unknown> {
  const model = options.model ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
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
      throw new Error(`Gemini request failed (${response.status})`);
    }

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Gemini returned an empty response");
    }
    return JSON.parse(text) as unknown;
  };
}
