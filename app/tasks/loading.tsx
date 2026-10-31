export default function TasksLoading() {
  return <div aria-label="Loading tasks" className="animate-pulse space-y-4" role="status">
    <span className="sr-only">Loading tasks…</span>
    <div className="h-28 rounded-xl border bg-card" />
    <div className="h-96 rounded-xl border bg-card" />
  </div>;
}
