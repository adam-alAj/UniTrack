import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Mail,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";

import type { TaskRecord } from "@/lib/tasks/schema";

type DashboardTask = Pick<
  TaskRecord,
  "id" | "title" | "type" | "status" | "due_at" | "needs_review" | "courses"
>;
type Announcement = {
  id: string;
  title: string;
  content: string | null;
  received_at: string | null;
  needs_review: boolean;
  courses: { name: string; course_code: string | null } | null;
};
type SyncRun = {
  status: string;
  started_at: string;
  finished_at: string | null;
  found_count: number;
  processed_count: number;
  failed_count: number;
};

function displayDate(value: string | null) {
  if (!value) return "No deadline set";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function StatCard({
  label,
  value,
  note,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: number | null;
  note: string;
  icon: typeof ClipboardList;
  tone?: "blue" | "amber" | "violet" | "green";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-800",
    violet: "bg-violet-50 text-violet-700",
    green: "bg-emerald-50 text-emerald-700",
  };
  return (
    <section className="bg-card rounded-xl border p-5 shadow-sm shadow-slate-200/30">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
        <span
          className={`flex size-9 items-center justify-center rounded-lg ${tones[tone]}`}
        >
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight">
        {value ?? "—"}
      </p>
      <p className="text-muted-foreground mt-2 text-xs">{note}</p>
    </section>
  );
}

function PanelEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof ClipboardList;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-6 py-8 text-center">
      <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-xl">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="text-muted-foreground mt-1 max-w-xs text-xs leading-5">
        {description}
      </p>
    </div>
  );
}

export function Overview({
  tasks,
  announcements,
  latestSync,
  queryFailed,
  counts,
  nowMs,
}: {
  tasks: DashboardTask[];
  announcements: Announcement[];
  latestSync: SyncRun | null;
  queryFailed: boolean;
  counts: {
    pending: number | null;
    dueSoon: number | null;
    exams: number | null;
    completed: number | null;
    overdue: number | null;
  };
  nowMs: number;
}) {
  const active = tasks.filter((task) => task.status !== "completed");
  const overdue = active
    .filter((task) => task.due_at && new Date(task.due_at).getTime() < nowMs)
    .sort((a, b) => a.due_at!.localeCompare(b.due_at!));
  const upcoming = active
    .filter((task) => !task.due_at || new Date(task.due_at).getTime() >= nowMs)
    .sort((a, b) => {
      if (!a.due_at) return b.due_at ? 1 : a.title.localeCompare(b.title);
      if (!b.due_at) return -1;
      return a.due_at.localeCompare(b.due_at);
    })
    .slice(0, 6);

  return (
    <>
      {queryFailed && (
        <div
          className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
          role="alert"
        >
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>
            Some dashboard data could not be loaded. Values from unavailable
            queries are shown as unavailable; refresh to try again.
          </span>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={ClipboardList}
          label="Pending tasks"
          value={counts.pending}
          note="All tasks not marked complete"
        />
        <StatCard
          icon={CalendarClock}
          label="Due soon"
          value={counts.dueSoon}
          note="Due in the next 7 days"
          tone="amber"
        />
        <StatCard
          icon={BookOpen}
          label="Upcoming exams"
          value={counts.exams}
          note="All dated exams still ahead"
          tone="violet"
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={counts.completed}
          note="Tasks you have finished"
          tone="green"
        />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(290px,1fr)]">
        <section className="bg-card overflow-hidden rounded-xl border shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="font-semibold">Upcoming tasks</h2>
              <p className="text-muted-foreground mt-1 text-xs">
                Your next deadlines and tasks without dates
              </p>
            </div>
            <Link
              className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
              href="/tasks"
            >
              View all <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          {queryFailed ? (
            <PanelEmpty
              icon={TriangleAlert}
              title="Tasks unavailable"
              description="The task query failed. Refresh the page to try again."
            />
          ) : upcoming.length ? (
            <ul className="divide-y">
              {upcoming.map((task) => (
                <li className="flex items-center gap-3 px-5 py-4" key={task.id}>
                  <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                    <ClipboardList className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="text-muted-foreground mt-1 truncate text-xs">
                      {task.courses?.course_code ||
                        task.courses?.name ||
                        task.type}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-medium">
                      {displayDate(task.due_at)}
                    </p>
                    {task.needs_review && (
                      <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-amber-800">
                        <ShieldAlert className="size-3" aria-hidden="true" />
                        Review
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <PanelEmpty
              icon={ClipboardList}
              title="A clear week starts here"
              description="Tasks from your courses will appear here. Add a task or connect your email sync."
            />
          )}
        </section>

        <section className="bg-card overflow-hidden rounded-xl border shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Recent announcements</h2>
            <p className="text-muted-foreground mt-1 text-xs">
              Latest updates from your courses
            </p>
          </div>
          {queryFailed ? (
            <PanelEmpty
              icon={TriangleAlert}
              title="Announcements unavailable"
              description="The announcements query failed. Refresh the page to try again."
            />
          ) : announcements.length ? (
            <ul className="divide-y">
              {announcements.map((announcement) => (
                <li className="px-5 py-4" key={announcement.id}>
                  <p className="line-clamp-2 text-sm font-medium">
                    {announcement.title}
                  </p>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-5">
                    {announcement.content ||
                      announcement.courses?.name ||
                      "Course update"}
                  </p>
                  <p className="text-muted-foreground mt-2 text-[11px]">
                    {announcement.received_at
                      ? displayDate(announcement.received_at)
                      : "Date unavailable"}
                    {announcement.needs_review ? " · Needs review" : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <PanelEmpty
              icon={Mail}
              title="Nothing new just yet"
              description="Course announcements will appear here after an email is processed."
            />
          )}
        </section>
      </div>

      <section className="bg-card mt-6 overflow-hidden rounded-xl border shadow-sm">
        <div className="flex items-center gap-3 px-5 py-4">
          <span className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg">
            <TriangleAlert className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold">Overdue</h2>
            <p className="text-muted-foreground mt-1 text-xs">
              Past deadlines that are not completed
            </p>
          </div>
          <span className="bg-muted ml-auto rounded-full px-2.5 py-1 text-xs font-medium">
            {counts.overdue ?? "—"}
          </span>
        </div>
        {queryFailed ? (
          <p className="text-muted-foreground border-t px-5 py-5 text-sm">
            Overdue tasks could not be loaded.
          </p>
        ) : overdue.length ? (
          <ul className="divide-y border-t">
            {overdue.slice(0, 5).map((task) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
                key={task.id}
              >
                <Link
                  className="hover:text-primary text-sm font-medium hover:underline"
                  href="/tasks"
                >
                  {task.title}
                </Link>
                <span className="text-destructive text-xs">
                  {displayDate(task.due_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground border-t px-5 py-5 text-sm">
            No overdue tasks. You’re up to date.
          </p>
        )}
      </section>

      <section className="bg-card mt-6 flex flex-col gap-3 rounded-xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg">
            <Mail className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium">Email sync</p>
            <p className="text-muted-foreground text-xs">
              {latestSync
                ? `${latestSync.processed_count} processed · ${latestSync.failed_count} failed · started ${displayDate(latestSync.started_at)}`
                : "No synchronization runs recorded yet."}
            </p>
          </div>
        </div>
        <span
          className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${!latestSync ? "bg-muted text-muted-foreground" : latestSync.status === "success" ? "bg-emerald-50 text-emerald-800" : latestSync.status === "running" ? "bg-blue-50 text-blue-800" : "bg-amber-50 text-amber-900"}`}
        >
          {queryFailed
            ? "Status unavailable"
            : (latestSync?.status ?? "Not synced")}
        </span>
      </section>
    </>
  );
}
