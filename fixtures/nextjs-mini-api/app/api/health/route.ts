function GET() {
  return Response.json({ ok: true });
}

function POST() {
  return Response.json({ created: true });
}

export { GET, POST };
