export type BookingStatus = "confirmed" | "waitlist" | "cancelled";

export type Booking = {
  id: string;
  guestName: string;
  slot: string;
  partySize: number;
  status: BookingStatus;
  notes: string;
};

export type BookingInput = {
  guestName: string;
  slot: string;
  partySize: number;
  notes?: string;
};

const STATUSES = new Set<BookingStatus>(["confirmed", "waitlist", "cancelled"]);

let sequence = 4;
let bookings: Booking[] = seed();

export function listBookings(): Booking[] {
  return [...bookings].sort((a, b) => a.slot.localeCompare(b.slot));
}

export function getBooking(id: string): Booking | undefined {
  return bookings.find((booking) => booking.id === id);
}

export function createBooking(input: BookingInput): Booking {
  const booking: Booking = {
    id: `bk_${sequence++}`,
    guestName: requireName(input.guestName),
    slot: requireSlot(input.slot),
    partySize: requirePartySize(input.partySize),
    status: "confirmed",
    notes: input.notes?.trim() ?? "",
  };
  bookings.push(booking);
  return booking;
}

export function updateBooking(
  id: string,
  patch: { status?: string; partySize?: number; notes?: string },
): Booking | undefined {
  const current = getBooking(id);
  if (!current) return undefined;
  if (patch.status !== undefined) {
    if (!STATUSES.has(patch.status as BookingStatus)) {
      throw new BookingError("status must be confirmed, waitlist, or cancelled");
    }
    current.status = patch.status as BookingStatus;
  }
  if (patch.partySize !== undefined) {
    current.partySize = requirePartySize(patch.partySize);
  }
  if (patch.notes !== undefined) {
    current.notes = patch.notes.trim();
  }
  return current;
}

export function deleteBooking(id: string): boolean {
  const index = bookings.findIndex((booking) => booking.id === id);
  if (index === -1) return false;
  bookings.splice(index, 1);
  return true;
}

export function searchBookings(q: string, limit = 20): Booking[] {
  const needle = q.trim().toLowerCase();
  const max = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 20;
  if (!needle) return listBookings().slice(0, max);
  return listBookings()
    .filter((booking) =>
      [booking.guestName, booking.slot, booking.status, booking.notes]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    )
    .slice(0, max);
}

export function resetBookings(): void {
  sequence = 4;
  bookings = seed();
}

export class BookingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingError";
  }
}

function seed(): Booking[] {
  return [
    {
      id: "bk_1",
      guestName: "Maya Chen",
      slot: "2026-09-18T19:00:00.000Z",
      partySize: 2,
      status: "confirmed",
      notes: "Window table if possible",
    },
    {
      id: "bk_2",
      guestName: "Jordan Blake",
      slot: "2026-09-19T12:30:00.000Z",
      partySize: 4,
      status: "confirmed",
      notes: "",
    },
    {
      id: "bk_3",
      guestName: "Sam Ortiz",
      slot: "2026-09-20T20:00:00.000Z",
      partySize: 6,
      status: "waitlist",
      notes: "Birthday",
    },
  ];
}

function requireName(value: string): string {
  const guestName = value.trim();
  if (guestName.length < 2) {
    throw new BookingError("guestName is required");
  }
  return guestName;
}

function requireSlot(value: string): string {
  const slot = new Date(value);
  if (Number.isNaN(slot.getTime())) {
    throw new BookingError("slot must be an ISO-8601 datetime");
  }
  return slot.toISOString();
}

function requirePartySize(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 12) {
    throw new BookingError("partySize must be an integer from 1 to 12");
  }
  return value;
}
