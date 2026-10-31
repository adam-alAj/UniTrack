export default function WorkspaceLoading() {
  return (
    <div
      aria-label="Loading workspace"
      className="animate-pulse space-y-5"
      role="status"
    >
      <span className="sr-only">Loading workspace…</span>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div className="bg-card h-32 rounded-xl border" key={item} />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(290px,1fr)]">
        <div className="bg-card h-80 rounded-xl border" />
        <div className="bg-card h-80 rounded-xl border" />
      </div>
    </div>
  );
}
