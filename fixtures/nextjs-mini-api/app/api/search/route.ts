import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const limit = url.searchParams.get("limit");
  return NextResponse.json({ q, limit });
}
