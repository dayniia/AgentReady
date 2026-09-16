import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return NextResponse.json({ id });
}

export async function PATCH(request: Request) {
  const { status } = await request.json();
  return NextResponse.json({ status });
}

export async function DELETE() {
  return new NextResponse(null, { status: 204 });
}
