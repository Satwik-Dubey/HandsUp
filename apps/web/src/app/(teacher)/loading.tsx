/** Placeholder while a teacher page loads: the shape of a page header and a few cards. */
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy aria-label="Loading">
      <div className="h-5 w-32 rounded-full bg-card" />
      <div className="h-14 w-2/3 max-w-lg rounded-3xl bg-card" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-4xl bg-card" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="h-72 rounded-4xl bg-card" />
        <div className="h-72 rounded-4xl bg-card" />
      </div>
    </div>
  );
}
