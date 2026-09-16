import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    res.status(201).json({ ok: true });
    return;
  }
  if (req.method === "GET") {
    res.status(200).json({ hello: "world" });
    return;
  }
  res.status(405).end();
}
