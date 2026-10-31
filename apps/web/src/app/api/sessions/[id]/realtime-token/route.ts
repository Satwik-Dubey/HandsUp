import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { requireOwnedSession } from "@/lib/teacher";

/** A 2-hour token that lets the teacher's dashboard join this session's room on the gateway. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { session, teacher } = await requireOwnedSession((await ctx.params).id);
  const secret = process.env.REALTIME_SECRET;
  if (!secret) return NextResponse.json({ error: "REALTIME_SECRET is not set" }, { status: 500 });

  const token = await new SignJWT({ sid: session.id })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(teacher.id)
    .setAudience("handsup-teacher")
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json({ token }, { headers: { "cache-control": "no-store" } });
}
