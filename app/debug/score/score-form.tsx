"use client";

import { useState, type FormEvent } from "react";
import { ABSENCE_CHECK_IDS } from "@/lib/score/hints";
import styles from "./score.module.css";

type CheckStatus = "pass" | "partial" | "fail" | "unverified";

type ScoreCheck = {
  id: string;
  category: number;
  label: string;
  max: number;
  score: number;
  status: CheckStatus;
  evidence: string;
  hint?: string;
};

type ScoreAxis = {
  label: string;
  total: number | null;
  max: number;
  raw?: number;
  rawMax?: number;
  band: string | null;
  note?: string;
};

type ScoreResponse = {
  url?: string;
  origin?: string;
  today?: ScoreAxis;
  frontier?: ScoreAxis;
  total?: number;
  max?: number;
  band?: string;
  categories?: { id: number; name: string; score: number; max: number }[];
  checks?: ScoreCheck[];
  warnings?: string[];
  error?: string;
};

function statusLabel(item: ScoreCheck): string {
  if (item.status === "unverified") return "⚠️ Could not verify";
  if (item.status === "pass") return "Pass";
  if (item.status === "partial") return "Partial";
  if (ABSENCE_CHECK_IDS.has(item.id)) return "❌ Not found";
  return "Fail";
}

export default function ScoreForm() {
  const [url, setUrl] = useState("https://example.com");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScoreResponse | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json()) as ScoreResponse;
      if (!response.ok) {
        setResult({ error: payload.error ?? `Score failed (${response.status})` });
        return;
      }
      setResult(payload);
    } catch (error) {
      setResult({
        error: error instanceof Error ? error.message : "Score failed",
      });
    } finally {
      setLoading(false);
    }
  }

  const today = result?.today;
  const frontier = result?.frontier;
  const todayChecks = result?.checks?.filter((item) => item.category !== 3) ?? [];
  const frontierChecks = result?.checks?.filter((item) => item.category === 3) ?? [];

  return (
    <div>
      <form className={styles.form} onSubmit={onSubmit}>
        <label htmlFor="scoreUrl">Live HTTPS URL</label>
        <input
          id="scoreUrl"
          name="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        <button type="submit" disabled={loading}>
          {loading ? "Scoring…" : "Score"}
        </button>
      </form>

      {result?.error ? <p className={styles.error}>{result.error}</p> : null}

      {result?.warnings?.length ? (
        <WarningList warnings={result.warnings} />
      ) : null}

      {today ? (
        <div className={styles.heroes}>
          <article className={styles.hero}>
            <p className={styles.heroKicker}>{today.label}</p>
            <p className={styles.total}>
              {today.total ?? "—"}
              <span aria-hidden="true">/{today.max}</span>
            </p>
            {today.band ? <p className={styles.band}>{today.band}</p> : null}
            <p className={styles.heroNote}>
              Discovery, structured data, and raw HTML — the score that
              differentiates sites today.
            </p>
            <p className={styles.meta}>{result?.url}</p>
          </article>
          {frontier ? (
            <article className={`${styles.hero} ${styles.frontier}`}>
              <p className={styles.heroKicker}>{frontier.label}</p>
              <p className={styles.total}>
                {frontier.total ?? "—"}
                <span aria-hidden="true">/{frontier.max}</span>
              </p>
              {frontier.total === 0 ? (
                <p className={styles.band}>Opportunity</p>
              ) : frontier.band ? (
                <p className={styles.band}>{frontier.band}</p>
              ) : (
                <p className={styles.band}>Could not verify</p>
              )}
              <p className={styles.heroNote}>
                {frontier.note ??
                  "Emerging standard, near-zero adoption industry-wide."}
              </p>
            </article>
          ) : null}
        </div>
      ) : null}

      {result?.categories?.length ? (
        <div className={styles.categories}>
          {result.categories.map((category) => (
            <article
              key={category.id}
              className={`${styles.category} ${category.id === 3 ? styles.frontierCategory : ""}`}
            >
              <p className={styles.categoryName}>{category.name}</p>
              <p className={styles.categoryScore}>
                {category.score}/{category.max}
              </p>
            </article>
          ))}
        </div>
      ) : null}

      {todayChecks.length ? (
        <CheckTable title="Today's checks" items={todayChecks} />
      ) : null}
      {frontierChecks.length ? (
        <CheckTable
          title="Frontier checks"
          items={frontierChecks}
          note="A 0 here is typical. Treat missing MCP/WebMCP/A2A as an opportunity, not a site failure."
        />
      ) : null}

      {result && !result.error && result.checks?.length ? (
        <details className={styles.json}>
          <summary>Raw JSON</summary>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </details>
      ) : null}
    </div>
  );
}

function WarningList({ warnings }: { warnings: string[] }) {
  const unverified = warnings.filter((warning) =>
    warning.startsWith("Could not verify"),
  );
  const rest = warnings.filter((warning) => !warning.startsWith("Could not verify"));
  if (rest.length === 0 && unverified.length === 0) return null;

  return (
    <ul className={styles.warnings}>
      {rest.map((warning) => (
        <li key={warning}>{warning}</li>
      ))}
      {unverified.length ? (
        <li>
          Could not verify {unverified.length} well-known path
          {unverified.length === 1 ? "" : "s"} after retries — excluded from the
          score, not counted as missing.
          <details>
            <summary>Paths</summary>
            <ul>
              {unverified.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </details>
        </li>
      ) : null}
    </ul>
  );
}

function CheckTable({
  title,
  items,
  note,
}: {
  title: string;
  items: ScoreCheck[];
  note?: string;
}) {
  return (
    <div className={styles.tableWrap}>
      <h2 className={styles.tableTitle}>{title}</h2>
      {note ? <p className={styles.tableNote}>{note}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Check</th>
            <th>Pts</th>
            <th>Status</th>
            <th>Evidence</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className={item.status === "unverified" ? styles.unverifiedRow : undefined}
            >
              <td>{item.label}</td>
              <td>
                {item.status === "unverified"
                  ? "excluded"
                  : `${item.score}/${item.max}`}
              </td>
              <td className={styles[item.status]}>{statusLabel(item)}</td>
              <td>
                <div>{item.evidence}</div>
                {item.hint ? <p className={styles.hint}>{item.hint}</p> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
