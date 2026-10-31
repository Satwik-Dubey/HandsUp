/** Placeholder while the class is looked up, shaped like the join card. */
export default function Loading() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex min-h-dvh w-full max-w-md animate-pulse flex-col gap-5 px-5 pt-5" aria-busy aria-label="Joining">
      <div className="h-7 w-28 rounded-full bg-card" />
      <div className="h-52 rounded-4xl bg-coral/40" />
      <div className="h-20 rounded-4xl bg-card" />
      <div className="h-14 rounded-full bg-card" />
    </main>
  );
}
