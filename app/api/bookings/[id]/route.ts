import {
  BookingError,
  deleteBooking,
  getBooking,
  updateBooking,
} from "@/lib/demo/store";

type BookingIdContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: BookingIdContext) {
  const { id } = await context.params;
  const booking = getBooking(id);
  if (!booking) {
    return Response.json({ error: "Booking not found" }, { status: 404 });
  }
  return Response.json(booking);
}

export async function PATCH(request: Request, context: BookingIdContext) {
  const { id } = await context.params;
  try {
    const { status, partySize, notes } = await request.json();
    const booking = updateBooking(id, { status, partySize, notes });
    if (!booking) {
      return Response.json({ error: "Booking not found" }, { status: 404 });
    }
    return Response.json(booking);
  } catch (error) {
    const message =
      error instanceof BookingError ? error.message : "JSON body required";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: BookingIdContext) {
  const { id } = await context.params;
  if (!deleteBooking(id)) {
    return Response.json({ error: "Booking not found" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
