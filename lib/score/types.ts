import { CHECK_HINTS } from "./hints";

export type CheckStatus = "pass" | "partial" | "fail" | "unverified";

export type ScoreCategoryId = 1 | 2 | 3 | 4;

export type ScoreCheck = {
  id: string;
  category: ScoreCategoryId;
  label: string;
  max: number;
  score: number;
  status: CheckStatus;
  evidence: string;
  hint?: string;
};

export type ScoreBand = "ready" | "strong" | "partial" | "weak" | "invisible";

export type ScoreCategory = {
  id: ScoreCategoryId;
  name: string;
  score: number;
  max: number;
};

export type ScoreAxis = {
  label: string;
  total: number | null;
  max: 100;
  raw: number;
  rawMax: number;
  band: ScoreBand | null;
  note?: string;
};

export type ScoreResult = {
  url: string;
  origin: string;
  today: ScoreAxis;
  frontier: ScoreAxis;
  total: number;
  max: 100;
  band: ScoreBand;
  categories: ScoreCategory[];
  checks: ScoreCheck[];
  warnings: string[];
};

export type ProbeDoc = {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
  truncated?: boolean;
  fetchError?: string;
};

export type ScoreDocuments = {
  targetUrl: string;
  homepage: ProbeDoc;
  byPath: Record<string, ProbeDoc | undefined>;
};

export function check(
  partial: Omit<ScoreCheck, "status"> & { status?: CheckStatus },
): ScoreCheck {
  if (partial.status === "unverified") {
    const { hint: _hint, ...rest } = partial;
    return { ...rest, score: 0, status: "unverified" };
  }
  const status =
    partial.status ??
    (partial.score >= partial.max
      ? "pass"
      : partial.score <= 0
        ? "fail"
        : "partial");
  const hint =
    status === "fail" || status === "partial"
      ? (partial.hint ?? CHECK_HINTS[partial.id]?.[status])
      : undefined;
  return hint ? { ...partial, status, hint } : { ...partial, status };
}

export function rescale(earned: number, max: number): number | null {
  if (max <= 0) return null;
  return Math.round((earned / max) * 100);
}

export function bandFor(total: number): ScoreBand {
  if (total >= 85) return "ready";
  if (total >= 65) return "strong";
  if (total >= 40) return "partial";
  if (total >= 15) return "weak";
  return "invisible";
}

export function isHttpOk(status: number): boolean {
  return status >= 200 && status < 300;
}
