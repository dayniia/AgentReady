import { describe, expect, it } from "vitest";
import {
  BookingError,
  createBooking,
  deleteBooking,
  getBooking,
  listBookings,
  resetBookings,
  searchBookings,
  updateBooking,
} from "./store";

describe("demo booking store", () => {
  it("seeds three reservations and can create, update, search, and delete", () => {
    resetBookings();
    expect(listBookings()).toHaveLength(3);

    const created = createBooking({
      guestName: "Alex Rivera",
      slot: "2026-09-21T18:00:00.000Z",
      partySize: 3,
      notes: "High chair",
    });
    expect(created.id).toMatch(/^bk_/);
    expect(getBooking(created.id)?.guestName).toBe("Alex Rivera");

    expect(updateBooking(created.id, { status: "waitlist" })?.status).toBe(
      "waitlist",
    );
    expect(searchBookings("rivera").map((row) => row.id)).toEqual([created.id]);
    expect(deleteBooking(created.id)).toBe(true);
    expect(getBooking(created.id)).toBeUndefined();
  });

  it("rejects invalid party sizes", () => {
    resetBookings();
    expect(() =>
      createBooking({
        guestName: "Pat",
        slot: "2026-09-21T18:00:00.000Z",
        partySize: 0,
      }),
    ).toThrow(BookingError);
  });
});
