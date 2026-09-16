import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await context.params;
  return NextResponse.json({ slug });
}
