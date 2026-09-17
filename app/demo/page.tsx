import type { Metadata } from "next";
import { listBookings } from "@/lib/demo/store";
import BookForm from "./book-form";
import styles from "./demo.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Harbor Table — reservations",
  description:
    "Harbor Table is a small restaurant booking desk. Agents and humans can list, search, create, update, and cancel table reservations.",
  openGraph: {
    title: "Harbor Table — reservations",
    description:
      "A deliberately simple booking app used to validate AgentReady's scan-to-output pipeline.",
  },
};

const schema = {
  "@context": "https://schema.org",
  "@type": ["Restaurant", "LocalBusiness"],
  name: "Harbor Table",
  description:
    "A small waterfront restaurant with an agent-ready booking API for listing, searching, creating, updating, and cancelling reservations.",
  servesCuisine: "Seasonal coastal",
  url: "/demo",
  potentialAction: {
    "@type": "ReserveAction",
    target: "/api/bookings",
    name: "Book a table",
  },
};

function formatSlot(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

export default function DemoPage() {
  const bookings = listBookings();

  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <p className={styles.kicker}>Demo app</p>
      <h1>Harbor Table</h1>
      <p>
        This is a tiny restaurant booking desk shipped with AgentReady. Scan
        this repository to extract the booking APIs, generate <code>llms.txt</code>{" "}
        and MCP tools, then score this page for agent readiness. The desk keeps
        a short in-memory list of reservations so the full pipeline has real
        routes to classify: list, create, search, update, and cancel.
      </p>
      <p className={styles.meta}>
        Humans use this page. Agents should prefer{" "}
        <a href="/api/bookings">/api/bookings</a>,{" "}
        <a href="/api/search">/api/search</a>, and{" "}
        <a href="/openapi.json">/openapi.json</a>. Manifests live at{" "}
        <a href="/llms.txt">/llms.txt</a> and <a href="/sitemap.xml">/sitemap.xml</a>.
      </p>

      <section className={styles.grid}>
        <article>
          <h2>Tonight&apos;s book</h2>
          {bookings.length === 0 ? (
            <p>No reservations yet. The first party can take any open slot.</p>
          ) : (
            <ul className={styles.list}>
              {bookings.map((booking) => (
                <li key={booking.id}>
                  <strong>{booking.guestName}</strong>
                  <span>
                    {formatSlot(booking.slot)} · party of {booking.partySize} ·{" "}
                    {booking.status}
                  </span>
                  {booking.notes ? <em>{booking.notes}</em> : null}
                </li>
              ))}
            </ul>
          )}
        </article>
        <BookForm />
      </section>
    </main>
  );
}
