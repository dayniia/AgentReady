import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <h1>AgentReady</h1>
      <p>
        Point this at a Next.js repo to extract routes and classify them for AI
        agents. Dashboard and generators land in later versions.
      </p>
    </main>
  );
}
