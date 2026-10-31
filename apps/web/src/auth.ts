import { eq, teachers } from "@handsup/db";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import { db } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

// `next dev -H 0.0.0.0` (so phones on Wi-Fi can connect) makes requests look like they came to 0.0.0.0,
// and Auth.js would then send Google a 0.0.0.0 callback, which Google and Safari both refuse.
// Pin the sign-in address to AUTH_URL, or else to the app's public address.
if (!process.env.AUTH_URL && process.env.NEXT_PUBLIC_APP_URL) process.env.AUTH_URL = process.env.NEXT_PUBLIC_APP_URL;

export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
export const devLoginEnabled = process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_LOGIN === "true";

const providers: Provider[] = [];
if (googleEnabled) providers.push(Google);
if (devLoginEnabled) {
  // Development only: sign in as a test teacher without Google.
  providers.push(
    Credentials({
      id: "dev",
      name: "Test teacher",
      credentials: { name: { label: "Name" }, email: { label: "Email" } },
      authorize: (c) => {
        const email = String(c?.email ?? "").trim().toLowerCase();
        if (!email.includes("@")) return null;
        return { id: `dev:${email}`, email, name: String(c?.name ?? "").trim() || "Test Teacher" };
      },
    }),
  );
}

/** Creates the teacher on first sign-in, so sign-up and sign-in are the same step. */
async function upsertTeacher(sub: string, email: string, name: string | null, image: string | null) {
  const [row] = await db
    .insert(teachers)
    .values({ googleSub: sub, email, name, image })
    .onConflictDoUpdate({ target: teachers.googleSub, set: { email, name, image } })
    .returning({ id: teachers.id });
  return row!.id;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  trustHost: true,
  callbacks: {
    async jwt({ token, account, user }) {
      if (account) {
        const sub = account.provider === "google" ? `google:${account.providerAccountId}` : `dev:${user.email}`;
        token.teacherId = await upsertTeacher(sub, (user.email ?? "").toLowerCase(), user.name ?? null, user.image ?? null);
      }
      return token;
    },
    session({ session, token }) {
      if (token.teacherId) session.user.id = token.teacherId as string;
      return session;
    },
  },
});

/** The signed-in teacher's row, or null (also null if the database was reset since sign-in). */
export async function currentTeacher() {
  const s = await auth();
  if (!s?.user?.id) return null;
  const t = await db.query.teachers.findFirst({ where: eq(teachers.id, s.user.id) });
  return t ?? null;
}
