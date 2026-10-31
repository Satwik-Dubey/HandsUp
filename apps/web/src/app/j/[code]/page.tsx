import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ipFrom, lookupJoinCode } from "@/lib/join";
import { StudentApp } from "./StudentApp";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  return { title: `Class ${(await params).code.toUpperCase()}` };
}

export default async function StudentPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const r = await lookupJoinCode(code, ipFrom(await headers()));
  if (!r.ok) redirect(`/join?code=${encodeURIComponent(code)}&error=${r.error}`);
  return <StudentApp info={r.info} />;
}
