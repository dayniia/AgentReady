import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <h1>AgentReady</h1>
      <p>
        Scan a Next.js repo for routes and generated agent files, or paste a
        live URL for an Agent Readiness Score.
      </p>
      <p>
        Pipeline inspectors: <a href="/debug/scan">/debug/scan</a> ·{" "}
        <a href="/debug/score">/debug/score</a>
      </p>
    </main>
  );
}
