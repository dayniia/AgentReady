"use client";

import { useState, type FormEvent } from "react";
import styles from "./scan.module.css";

type ScanRow = {
  method: string;
  path: string;
  action_name: string;
  classification_status: string;
  description: string;
  action_type: string;
  parameters: unknown;
  filePath: string;
};

type ScanResponse = {
  repo?: { owner: string; repo: string; ref?: string };
  routes?: ScanRow[];
  warnings?: string[];
  error?: string;
};

export default function ScanForm() {
  const [githubUrl, setGithubUrl] = useState(
    "https://github.com/dayniia/AgentReady/tree/feat/v0.1-core",
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResponse | null>(null);

  async function scan(body: { githubUrl?: string; workspace?: boolean }) {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as ScanResponse;
      if (!response.ok) {
        setResult({ error: payload.error ?? `Scan failed (${response.status})` });
        return;
      }
      setResult(payload);
    } catch (error) {
      setResult({
        error: error instanceof Error ? error.message : "Scan failed",
      });
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await scan({ githubUrl });
  }

  return (
    <div>
      <form className={styles.form} onSubmit={onSubmit}>
        <label htmlFor="githubUrl">GitHub URL</label>
        <input
          id="githubUrl"
          name="githubUrl"
          value={githubUrl}
          onChange={(event) => setGithubUrl(event.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        <button type="submit" disabled={loading}>
          {loading ? "Scanning…" : "Scan"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => scan({ workspace: true })}
        >
          Scan this workspace
        </button>
      </form>

      {result?.error ? <p className={styles.error}>{result.error}</p> : null}

      {result?.warnings?.length ? (
        <ul className={styles.warnings}>
          {result.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      {result?.repo ? (
        <p className={styles.meta}>
          {result.repo.owner}/{result.repo.repo}
          {result.repo.ref ? `@${result.repo.ref}` : ""} — {result.routes?.length ?? 0}{" "}
          routes
        </p>
      ) : null}

      {result?.routes && result.routes.length > 0 ? (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Path</th>
                <th>Action</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {result.routes.map((route) => (
                <tr key={`${route.method}:${route.path}:${route.filePath}`}>
                  <td>{route.method}</td>
                  <td>{route.path}</td>
                  <td>{route.action_name}</td>
                  <td>{route.classification_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <pre className={styles.json}>
            {JSON.stringify(result.routes, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
