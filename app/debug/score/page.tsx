import ScoreForm from "./score-form";
import styles from "./score.module.css";

export default function DebugScorePage() {
  return (
    <main className={styles.page}>
      <p className={styles.kicker}>Debug</p>
      <h1>Agent Readiness Score</h1>
      <p className={styles.lede}>
        Paste a live HTTPS URL. The scorer fetches raw HTML and a short list of
        well-known files (no JavaScript execution, no Gemini), retrying
        transient network errors. Today&apos;s Readiness is the headline score;
        Frontier Score (MCP / WebMCP / A2A) is shown separately because
        industry adoption is still near zero. Timeouts are &quot;Could not
        verify,&quot; not &quot;Not found.&quot; This page is a pipeline
        inspector, not the product dashboard.
      </p>
      <ScoreForm />
    </main>
  );
}
