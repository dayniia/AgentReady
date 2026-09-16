import ScanForm from "./scan-form";
import styles from "./scan.module.css";

export default function DebugScanPage() {
  return (
    <main className={styles.page}>
      <p className={styles.kicker}>Debug</p>
      <h1>Scan a public GitHub repo</h1>
      <p className={styles.lede}>
        Paste a Next.js repository URL. This page is a pipeline inspector, not
        the product dashboard.
      </p>
      <ScanForm />
    </main>
  );
}
