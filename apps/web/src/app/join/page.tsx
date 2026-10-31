import { JoinForm } from "./JoinForm";

export const metadata = { title: "Join a class", description: "Enter your class code to react, ask and vote anonymously. No app, no account." };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string; error?: string }> }) {
  const { code, error } = await searchParams;
  return <JoinForm initialCode={code ?? ""} initialError={error ?? null} />;
}
