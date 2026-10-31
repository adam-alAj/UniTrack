"use client";

import { type FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowDownUp,
  ExternalLink,
  FilterX,
  Plus,
  Search,
  ShieldAlert,
} from "lucide-react";

import { createTask, updateTask } from "@/app/tasks/actions";
import { Button } from "@/components/ui/button";
import type { TaskActionResult, TaskRecord } from "@/lib/tasks/schema";

export type CourseOption = {
  id: string;
  name: string;
  course_code: string | null;
};
type DateFilter = "all" | "overdue" | "next7" | "no_deadline";
type SortMode = "due_asc" | "due_desc" | "created_desc" | "created_asc";

const statusLabel: Record<TaskRecord["status"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

const typeLabel: Record<TaskRecord["type"], string> = {
  assignment: "Assignment",
  quiz: "Quiz",
  exam: "Exam",
  other: "Other",
};

function formatDate(value: string | null) {
  if (!value) return "No deadline";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function localDateTimeValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function safeGmailUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "mail.google.com"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function TaskEditor({
  task,
  courses,
  onClose,
  onSaved,
}: {
  task: TaskRecord | null;
  courses: CourseOption[];
  onClose: () => void;
  onSaved: (result: TaskActionResult) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const gmailUrl = safeGmailUrl(task?.email_messages?.gmail_url ?? null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget);
    const localDeadline = String(formData.get("due_at") ?? "").trim();
    if (localDeadline) {
      const deadline = new Date(localDeadline);
      if (Number.isNaN(deadline.getTime())) {
        setError("Enter a valid deadline.");
        return;
      }
      formData.set("due_at", deadline.toISOString());
    }
    startTransition(async () => {
      const result = task
        ? await updateTask(formData)
        : await createTask(formData);
      if (result.success) onSaved(result);
      else setError(result.error);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="task-editor-title"
        aria-modal="true"
        className="bg-card max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border p-5 shadow-xl sm:max-w-2xl sm:rounded-2xl sm:p-7"
        role="dialog"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {task ? "Task details" : "New task"}
            </p>
            <h2 className="mt-1 text-xl font-semibold" id="task-editor-title">
              {task ? "Review and edit task" : "Add a task"}
            </h2>
          </div>
          <Button onClick={onClose} type="button" variant="outline">
            Close
          </Button>
        </div>

        {task?.needs_review && (
          <div className="mb-5 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <ShieldAlert
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <div>
              <p className="font-medium">Needs your review</p>
              <p className="mt-0.5 text-xs">
                {task.review_reasons.length
                  ? task.review_reasons
                      .map((reason) => reason.replaceAll("_", " "))
                      .join(" · ")
                  : "Please verify the extracted details."}
              </p>
            </div>
          </div>
        )}

        <form className="space-y-4" onSubmit={submit}>
          {task && <input name="id" type="hidden" value={task.id} />}
          <label className="block space-y-1.5 text-sm font-medium">
            Title
            <input
              className="bg-background h-10 w-full rounded-lg border px-3 font-normal"
              maxLength={500}
              name="title"
              required
              defaultValue={task?.title ?? ""}
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            Description
            <textarea
              className="bg-background min-h-24 w-full rounded-lg border px-3 py-2 font-normal"
              maxLength={20000}
              name="description"
              defaultValue={task?.description ?? ""}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm font-medium">
              Course
              <select
                className="bg-background h-10 w-full rounded-lg border px-3 font-normal"
                defaultValue={task?.course_id ?? ""}
                name="course_id"
              >
                <option value="">No course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.course_code ? `${course.course_code} · ` : ""}
                    {course.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              Type
              <select
                className="bg-background h-10 w-full rounded-lg border px-3 font-normal"
                defaultValue={task?.type ?? "assignment"}
                name="type"
              >
                {Object.entries(typeLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              Status
              <select
                className="bg-background h-10 w-full rounded-lg border px-3 font-normal"
                defaultValue={task?.status ?? "not_started"}
                name="status"
              >
                {Object.entries(statusLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              Deadline{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
              <input
                className="bg-background h-10 w-full rounded-lg border px-3 font-normal"
                name="due_at"
                type="datetime-local"
                defaultValue={localDateTimeValue(task?.due_at ?? null)}
              />
            </label>
          </div>

          {task && (
            <div className="bg-muted/60 rounded-lg p-3 text-sm">
              <p className="font-medium">Source email</p>
              {task.email_messages ? (
                <p className="text-muted-foreground mt-1 break-words">
                  {task.email_messages.subject || "(No subject)"} ·{" "}
                  {task.email_messages.sender}
                </p>
              ) : (
                <p className="text-muted-foreground mt-1">
                  Manually created task
                </p>
              )}
              {gmailUrl && (
                <a
                  className="text-primary mt-2 inline-flex items-center gap-1 hover:underline"
                  href={gmailUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Open original email{" "}
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              )}
              {task.original_due_text && (
                <p className="text-muted-foreground mt-2 text-xs">
                  Source deadline wording: {task.original_due_text}
                </p>
              )}
            </div>
          )}

          {error && (
            <p
              aria-live="polite"
              className="text-destructive flex items-center gap-2 text-sm"
            >
              <AlertCircle className="size-4" aria-hidden="true" />
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? "Saving…" : task ? "Save changes" : "Create task"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function TaskManager({
  initialTasks,
  courses,
  nowMs,
}: {
  initialTasks: TaskRecord[];
  courses: CourseOption[];
  nowMs: number;
}) {
  const tasks = initialTasks;
  const [selected, setSelected] = useState<TaskRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [courseId, setCourseId] = useState("all");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [sort, setSort] = useState<SortMode>("due_asc");
  const router = useRouter();

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const nextWeek = nowMs + 7 * 24 * 60 * 60 * 1000;
    const filtered = tasks.filter((task) => {
      if (
        query &&
        ![
          task.title,
          task.description ?? "",
          task.courses?.name ?? "",
          task.courses?.course_code ?? "",
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query)
      )
        return false;
      if (courseId !== "all" && task.course_id !== courseId) return false;
      if (type !== "all" && task.type !== type) return false;
      if (status !== "all" && task.status !== status) return false;
      if (dateFilter === "no_deadline" && task.due_at) return false;
      if (
        dateFilter === "overdue" &&
        (!task.due_at ||
          new Date(task.due_at).getTime() >= nowMs ||
          task.status === "completed")
      )
        return false;
      if (
        dateFilter === "next7" &&
        (!task.due_at ||
          new Date(task.due_at).getTime() < nowMs ||
          new Date(task.due_at).getTime() > nextWeek)
      )
        return false;
      return true;
    });

    return filtered.sort((a, b) => {
      if (sort === "created_desc")
        return b.created_at.localeCompare(a.created_at);
      if (sort === "created_asc")
        return a.created_at.localeCompare(b.created_at);
      if (!a.due_at)
        return b.due_at ? 1 : b.created_at.localeCompare(a.created_at);
      if (!b.due_at) return -1;
      return sort === "due_asc"
        ? a.due_at.localeCompare(b.due_at)
        : b.due_at.localeCompare(a.due_at);
    });
  }, [tasks, search, courseId, type, status, dateFilter, sort, nowMs]);

  function onSaved(result: TaskActionResult) {
    if (!result.success) return;
    setSelected(null);
    setCreating(false);
    router.refresh();
  }

  return (
    <>
      <section className="bg-card rounded-xl border p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block min-w-0 flex-1 lg:max-w-sm">
            <Search
              className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              aria-label="Search tasks"
              className="bg-background h-10 w-full rounded-lg border pr-3 pl-9 text-sm"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks or courses"
              value={search}
            />
          </label>
          <Button className="gap-2" onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden="true" />
            New task
          </Button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <label className="sr-only" htmlFor="course-filter">
            Course
          </label>
          <select
            id="course-filter"
            className="bg-background h-10 rounded-lg border px-3 text-sm"
            onChange={(event) => setCourseId(event.target.value)}
            value={courseId}
          >
            <option value="all">All courses</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.course_code ? `${course.course_code} · ` : ""}
                {course.name}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="type-filter">
            Type
          </label>
          <select
            id="type-filter"
            className="bg-background h-10 rounded-lg border px-3 text-sm"
            onChange={(event) => setType(event.target.value)}
            value={type}
          >
            <option value="all">All types</option>
            {Object.entries(typeLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="status-filter">
            Status
          </label>
          <select
            id="status-filter"
            className="bg-background h-10 rounded-lg border px-3 text-sm"
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            <option value="all">All statuses</option>
            {Object.entries(statusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="date-filter">
            Deadline
          </label>
          <select
            id="date-filter"
            className="bg-background h-10 rounded-lg border px-3 text-sm"
            onChange={(event) =>
              setDateFilter(event.target.value as DateFilter)
            }
            value={dateFilter}
          >
            <option value="all">Any deadline</option>
            <option value="overdue">Overdue</option>
            <option value="next7">Next 7 days</option>
            <option value="no_deadline">No deadline</option>
          </select>
          <label className="relative">
            <span className="sr-only">Sort tasks</span>
            <ArrowDownUp
              className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <select
              className="bg-background h-10 w-full rounded-lg border pr-3 pl-9 text-sm"
              onChange={(event) => setSort(event.target.value as SortMode)}
              value={sort}
            >
              <option value="due_asc">Deadline: soonest</option>
              <option value="due_desc">Deadline: latest</option>
              <option value="created_desc">Created: newest</option>
              <option value="created_asc">Created: oldest</option>
            </select>
          </label>
        </div>
      </section>

      <div className="text-muted-foreground mt-4 flex items-center justify-between text-sm">
        <span>
          {filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"}
        </span>
        {(search ||
          courseId !== "all" ||
          type !== "all" ||
          status !== "all" ||
          dateFilter !== "all") && (
          <button
            className="hover:text-foreground inline-flex items-center gap-1"
            onClick={() => {
              setSearch("");
              setCourseId("all");
              setType("all");
              setStatus("all");
              setDateFilter("all");
            }}
          >
            <FilterX className="size-4" aria-hidden="true" />
            Clear filters
          </button>
        )}
      </div>

      <section
        aria-label="Tasks"
        className="bg-card mt-3 overflow-hidden rounded-xl border shadow-sm"
      >
        {filteredTasks.length ? (
          <>
            <div className="bg-muted/40 text-muted-foreground hidden grid-cols-[minmax(0,2fr)_minmax(110px,1fr)_minmax(140px,1.2fr)_minmax(120px,1fr)] gap-4 border-b px-5 py-3 text-xs font-semibold tracking-wide uppercase md:grid">
              <span>Task</span>
              <span>Course / type</span>
              <span>Deadline</span>
              <span>Status</span>
            </div>
            <ul className="divide-y">
              {filteredTasks.map((task) => (
                <li key={task.id}>
                  <button
                    className="hover:bg-muted/40 grid w-full gap-3 p-4 text-left transition-colors md:grid-cols-[minmax(0,2fr)_minmax(110px,1fr)_minmax(140px,1.2fr)_minmax(120px,1fr)] md:items-center md:gap-4 md:px-5"
                    onClick={() => setSelected(task)}
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">
                          {task.title}
                        </span>
                        {task.needs_review && (
                          <span
                            aria-label="Needs review"
                            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900"
                          >
                            <ShieldAlert
                              className="size-3"
                              aria-hidden="true"
                            />
                            Review
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground mt-1 block truncate text-xs">
                        {task.description || typeLabel[task.type]}
                      </span>
                    </span>
                    <span className="text-muted-foreground text-xs">
                      <span className="text-foreground block font-medium">
                        {task.courses?.course_code ||
                          task.courses?.name ||
                          "No course"}
                      </span>
                      {typeLabel[task.type]}
                    </span>
                    <span
                      className={`text-xs ${task.due_at && new Date(task.due_at).getTime() < nowMs && task.status !== "completed" ? "text-destructive font-semibold" : "text-muted-foreground"}`}
                    >
                      {formatDate(task.due_at)}
                    </span>
                    <span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${task.status === "completed" ? "bg-emerald-50 text-emerald-800" : task.status === "in_progress" ? "bg-blue-50 text-blue-800" : "bg-muted text-muted-foreground"}`}
                      >
                        {statusLabel[task.status]}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
            <span className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-xl">
              <Search className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-medium">
              {tasks.length
                ? "No tasks match these filters"
                : "Your task list is clear"}
            </h2>
            <p className="text-muted-foreground mt-1 max-w-sm text-sm leading-6">
              {tasks.length
                ? "Try adjusting your search or filters."
                : "Tasks created from course emails will appear here. You can also add one yourself."}
            </p>
            {!tasks.length && (
              <Button className="mt-4 gap-2" onClick={() => setCreating(true)}>
                <Plus className="size-4" aria-hidden="true" />
                Add your first task
              </Button>
            )}
          </div>
        )}
      </section>

      {(selected || creating) && (
        <TaskEditor
          courses={courses}
          onClose={() => {
            setSelected(null);
            setCreating(false);
          }}
          onSaved={onSaved}
          task={selected}
        />
      )}
    </>
  );
}
