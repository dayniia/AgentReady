import { BookingError, createBooking, listBookings } from "@/lib/demo/store";

export async function GET() {
  return Response.json({ bookings: listBookings() });
}

export async function POST(request: Request) {
  try {
    const { guestName, slot, partySize, notes } = await request.json();
    const booking = createBooking({
      guestName: guestName ?? "",
      slot: slot ?? "",
      partySize: Number(partySize),
      notes,
    });
    return Response.json(booking, { status: 201 });
  } catch (error) {
    const message =
      error instanceof BookingError ? error.message : "JSON body with guestName, slot, and partySize is required";
    return Response.json({ error: message }, { status: 400 });
  }
}
