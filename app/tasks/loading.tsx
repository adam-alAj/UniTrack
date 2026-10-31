export default function TasksLoading() {
  return (
    <div
      aria-label="Loading tasks"
      className="animate-pulse space-y-4"
      role="status"
    >
      <span className="sr-only">Loading tasks…</span>
      <div className="bg-card h-28 rounded-xl border" />
      <div className="bg-card h-96 rounded-xl border" />
    </div>
  );
}
