"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { TaskEditor, type CourseOption } from "@/components/tasks/task-manager";
import { Button } from "@/components/ui/button";
import { buildMonthCells, localDateKey } from "@/lib/calendar/date-utils";
import type { TaskActionResult, TaskRecord } from "@/lib/tasks/schema";

type CalendarTask = Pick<
  TaskRecord,
  | "id"
  | "user_id"
  | "course_id"
  | "source_email_id"
  | "title"
  | "description"
  | "type"
  | "status"
  | "priority"
  | "due_at"
  | "source_url"
  | "needs_review"
  | "original_due_text"
  | "review_reasons"
  | "created_at"
  | "updated_at"
  | "courses"
  | "email_messages"
>;

const eventStyle: Record<TaskRecord["type"], string> = {
  assignment: "border-blue-200 bg-blue-50 text-blue-900",
  quiz: "border-amber-200 bg-amber-50 text-amber-950",
  exam: "border-violet-200 bg-violet-50 text-violet-950",
  other: "border-slate-200 bg-slate-50 text-slate-800",
};

const eventLabel: Record<TaskRecord["type"], string> = {
  assignment: "Assignment",
  quiz: "Quiz",
  exam: "Exam",
  other: "Other",
};

function localTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AcademicCalendar({
  tasks,
  courses,
}: {
  tasks: CalendarTask[];
  courses: CourseOption[];
}) {
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selected, setSelected] = useState<TaskRecord | null>(null);
  const router = useRouter();
  const cells = useMemo(() => buildMonthCells(month), [month]);
  const groupedTasks = useMemo(() => {
    const groups = new Map<string, CalendarTask[]>();
    for (const task of tasks) {
      if (!task.due_at) continue;
      const key = localDateKey(new Date(task.due_at));
      groups.set(key, [...(groups.get(key) ?? []), task]);
    }
    for (const group of groups.values())
      group.sort((a, b) => a.due_at!.localeCompare(b.due_at!));
    return groups;
  }, [tasks]);

  const monthName = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(month);
  const thisMonthEvents = cells.reduce(
    (total, cell) =>
      total +
      (cell.getMonth() === month.getMonth()
        ? (groupedTasks.get(localDateKey(cell))?.length ?? 0)
        : 0),
    0,
  );
  const today = localDateKey(new Date());

  function moveMonth(amount: number) {
    setMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + amount, 1),
    );
  }

  function saved(result: TaskActionResult) {
    if (result.success) {
      setSelected(null);
      router.refresh();
    }
  }

  return (
    <>
      <section className="bg-card rounded-xl border p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Deadlines in your local timezone
            </p>
            <h2 className="mt-1 text-xl font-semibold">{monthName}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() =>
                setMonth(
                  new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                )
              }
              type="button"
              variant="outline"
            >
              Today
            </Button>
            <Button
              aria-label="Previous month"
              onClick={() => moveMonth(-1)}
              size="icon"
              type="button"
              variant="outline"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <Button
              aria-label="Next month"
              onClick={() => moveMonth(1)}
              size="icon"
              type="button"
              variant="outline"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <div
          aria-label="Calendar event types"
          className="text-muted-foreground mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs"
        >
          {(["assignment", "quiz", "exam"] as const).map((type) => (
            <span className="inline-flex items-center gap-2" key={type}>
              <span
                className={`size-2.5 rounded-full ${type === "assignment" ? "bg-blue-600" : type === "quiz" ? "bg-amber-500" : "bg-violet-600"}`}
              />
              {eventLabel[type]}
            </span>
          ))}
        </div>
        <div
          className="mt-4 grid grid-cols-7 border-t border-l"
          role="grid"
          aria-label={monthName}
        >
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div
              aria-label={day}
              className="bg-muted/40 text-muted-foreground border-r border-b px-1 py-2 text-center text-[10px] font-semibold uppercase sm:px-2 sm:text-xs"
              key={day}
              role="columnheader"
            >
              {day}
            </div>
          ))}
          {cells.map((cell) => {
            const key = localDateKey(cell);
            const inMonth = cell.getMonth() === month.getMonth();
            const dayTasks = groupedTasks.get(key) ?? [];
            return (
              <div
                aria-label={`${cell.toLocaleDateString(undefined, { dateStyle: "full" })}${dayTasks.length ? `, ${dayTasks.length} tasks` : ""}`}
                className={`min-h-24 border-r border-b p-1 sm:min-h-32 sm:p-2 ${inMonth ? "bg-card" : "bg-muted/20 text-muted-foreground/60"}`}
                key={key}
                role="gridcell"
              >
                <span
                  className={`inline-flex size-6 items-center justify-center rounded-full text-xs ${key === today ? "bg-primary text-primary-foreground font-semibold" : ""}`}
                >
                  {cell.getDate()}
                </span>
                <ul className="mt-1 space-y-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <li key={task.id}>
                      <button
                        className={`block w-full truncate rounded border px-1.5 py-1 text-left text-[10px] leading-4 sm:text-xs ${eventStyle[task.type]} ${task.status === "completed" ? "line-through opacity-60" : ""}`}
                        onClick={() => setSelected(task)}
                        title={`${eventLabel[task.type]} · ${task.title} · ${localTime(task.due_at!)}`}
                        type="button"
                      >
                        <span className="font-semibold">
                          {localTime(task.due_at!)}
                        </span>{" "}
                        {task.title}
                      </button>
                    </li>
                  ))}
                  {dayTasks.length > 3 && (
                    <li className="text-muted-foreground px-1 text-[10px]">
                      +{dayTasks.length - 3} more
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
        {thisMonthEvents === 0 && (
          <p className="bg-muted/50 text-muted-foreground mt-4 rounded-lg px-4 py-3 text-sm">
            No dated tasks this month. Tasks without deadlines stay off the
            calendar.
          </p>
        )}
        <p className="text-muted-foreground mt-3 text-xs">
          Select a task to view its details. Assignment, quiz, and exam
          deadlines use your device’s local timezone.
        </p>
      </section>
      {selected && (
        <TaskEditor
          courses={courses}
          onClose={() => setSelected(null)}
          onSaved={saved}
          task={selected}
        />
      )}
    </>
  );
}
