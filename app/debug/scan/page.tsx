import ScanForm from "./scan-form";
import styles from "./scan.module.css";

export default function DebugScanPage() {
  return (
    <main className={styles.page}>
      <p className={styles.kicker}>Debug</p>
      <h1>Scan a public GitHub repo</h1>
      <p className={styles.lede}>
        Paste a Next.js repository URL, or scan this workspace if GitHub HTTPS
        is blocked on your network. After a scan you can copy or download
        `llms.txt` and MCP tool files. Live URL scoring lives at
        `/debug/score`. This page is a pipeline inspector, not the product
        dashboard.
      </p>
      <ScanForm />
    </main>
  );
}
