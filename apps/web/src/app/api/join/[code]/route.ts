import { NextResponse, type NextRequest } from "next/server";
import { ipFrom, lookupJoinCode } from "@/lib/join";

/** Public: what the join screen needs to know about a class code. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const r = await lookupJoinCode((await ctx.params).code, ipFrom(req.headers));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "not_found" ? 404 : 429 });
  return NextResponse.json(r.info, { headers: { "cache-control": "no-store" } });
}
