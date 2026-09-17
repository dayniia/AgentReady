import { searchBookings } from "@/lib/demo/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const limitValue = url.searchParams.get("limit");
  const limit = limitValue ? Number(limitValue) : 20;
  return Response.json({ q, bookings: searchBookings(q, limit) });
}
