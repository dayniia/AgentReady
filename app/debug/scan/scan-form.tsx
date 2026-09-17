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
  outputs?: { filename: string; content: string }[];
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
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {result.routes.map((route) => (
                <tr key={`${route.method}:${route.path}:${route.filePath}`}>
                  <td>{route.method}</td>
                  <td>{route.path}</td>
                  <td>{route.action_name}</td>
                  <td>{route.classification_status}</td>
                  <td>
                    {route.classification_status === "unclassified"
                      ? route.description
                      : route.action_type}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <pre className={styles.json}>
            {JSON.stringify(result.routes, null, 2)}
          </pre>
        </div>
      ) : null}

      {result?.outputs && result.outputs.length > 0 ? (
        <section className={styles.outputs}>
          <div className={styles.outputHeader}>
            <h2>Generated files</h2>
            <button
              type="button"
              onClick={() => downloadZip(result.outputs ?? [])}
            >
              Download all zip
            </button>
          </div>
          {result.outputs.map((file) => (
            <OutputBlock key={file.filename} file={file} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function OutputBlock({ file }: { file: { filename: string; content: string } }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(file.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <article className={styles.outputBlock}>
      <div className={styles.outputHeader}>
        <h3>{file.filename}</h3>
        <button type="button" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className={styles.json}>{file.content}</pre>
    </article>
  );
}

async function downloadZip(files: { filename: string; content: string }[]) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.filename, file.content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "agent-ready-outputs.zip";
  link.click();
  URL.revokeObjectURL(url);
}
