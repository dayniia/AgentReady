export type LlmsQuality = "missing" | "stub" | "populated";

export function assessLlmsTxt(text: string | undefined): LlmsQuality {
  if (text === undefined) return "missing";
  const trimmed = text.trim();
  if (!trimmed) return "stub";

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length <= 1) return "stub";

  const hasTitle = /^#\s+\S+/m.test(trimmed);
  const links = [...trimmed.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)];
  const hasDescription = trimmed.split(/\n\s*\n/).some((block) => {
    const prose = block
      .replace(/^#+\s+.*/gm, "")
      .replace(/\[[^\]]+\]\([^)]+\)/g, "")
      .replace(/^\s*[-*]\s+/gm, "")
      .trim();
    return prose.length >= 40;
  });

  if (hasTitle && hasDescription && links.length >= 3) {
    return "populated";
  }
  return "stub";
}
