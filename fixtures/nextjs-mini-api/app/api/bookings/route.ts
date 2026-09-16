import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ bookings: [] });
}

export async function POST(request: Request) {
  const { title, date } = await request.json();
  return NextResponse.json({ id: "1", title, date }, { status: 201 });
}
