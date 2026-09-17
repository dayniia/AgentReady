"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./demo.module.css";

export default function BookForm() {
  const router = useRouter();
  const [guestName, setGuestName] = useState("");
  const [slot, setSlot] = useState("2026-09-21T18:00");
  const [partySize, setPartySize] = useState(2);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName,
          slot: new Date(slot).toISOString(),
          partySize,
          notes,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? `Could not book (${response.status})`);
        return;
      }
      setGuestName("");
      setNotes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not book");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <h2>Reserve a table</h2>
      <label htmlFor="guestName">Guest name</label>
      <input
        id="guestName"
        name="guestName"
        value={guestName}
        onChange={(event) => setGuestName(event.target.value)}
        required
        autoComplete="name"
      />
      <label htmlFor="slot">Date and time</label>
      <input
        id="slot"
        name="slot"
        type="datetime-local"
        value={slot}
        onChange={(event) => setSlot(event.target.value)}
        required
      />
      <label htmlFor="partySize">Party size</label>
      <input
        id="partySize"
        name="partySize"
        type="number"
        min={1}
        max={12}
        value={partySize}
        onChange={(event) => setPartySize(Number(event.target.value))}
        required
      />
      <label htmlFor="notes">Notes</label>
      <input
        id="notes"
        name="notes"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />
      {error ? <p className={styles.error}>{error}</p> : null}
      <button type="submit" disabled={saving}>
        {saving ? "Booking…" : "Book table"}
      </button>
    </form>
  );
}
