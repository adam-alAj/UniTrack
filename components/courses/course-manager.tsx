"use client";

import { type FormEvent, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, BookOpen, Pencil, Plus, Trash2 } from "lucide-react";

import { createCourse, deleteCourse, updateCourse } from "@/app/courses/actions";
import { Button } from "@/components/ui/button";
import type { CourseActionResult, CourseRecord } from "@/lib/courses/schema";

const colors = ["blue", "violet", "green", "amber", "rose", "slate"] as const;
const colorStyle: Record<(typeof colors)[number], string> = {
  blue: "bg-blue-100 text-blue-800",
  violet: "bg-violet-100 text-violet-800",
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-900",
  rose: "bg-rose-100 text-rose-800",
  slate: "bg-slate-100 text-slate-700",
};

function CourseEditor({ course, onClose, onSaved }: { course: CourseRecord | null; onClose: () => void; onSaved: (result: CourseActionResult) => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError("");
    startTransition(async () => {
      const result = course ? await updateCourse(formData) : await createCourse(formData);
      if (result.success) onSaved(result);
      else setError(result.error);
    });
  }

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section aria-labelledby="course-editor-title" aria-modal="true" className="w-full rounded-t-2xl border bg-card p-5 shadow-xl sm:max-w-xl sm:rounded-2xl sm:p-7" role="dialog">
      <div className="mb-5 flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Course details</p><h2 className="mt-1 text-xl font-semibold" id="course-editor-title">{course ? "Edit course" : "Add a course"}</h2></div><Button onClick={onClose} type="button" variant="outline">Close</Button></div>
      <form className="space-y-4" onSubmit={submit}>
        {course && <input name="id" type="hidden" value={course.id} />}
        <label className="block space-y-1.5 text-sm font-medium">Course name<input className="h-10 w-full rounded-lg border bg-background px-3 font-normal" maxLength={160} name="name" required defaultValue={course?.name ?? ""} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm font-medium">Course code <span className="font-normal text-muted-foreground">(optional)</span><input className="h-10 w-full rounded-lg border bg-background px-3 font-normal" maxLength={64} name="course_code" defaultValue={course?.course_code ?? ""} /></label>
          <label className="block space-y-1.5 text-sm font-medium">Instructor <span className="font-normal text-muted-foreground">(optional)</span><input className="h-10 w-full rounded-lg border bg-background px-3 font-normal" maxLength={160} name="instructor" defaultValue={course?.instructor ?? ""} /></label>
        </div>
        <label className="block space-y-1.5 text-sm font-medium">Aliases <span className="font-normal text-muted-foreground">(comma-separated)</span><input className="h-10 w-full rounded-lg border bg-background px-3 font-normal" maxLength={2000} name="aliases" placeholder="Short names or alternate codes" defaultValue={course?.aliases.join(", ") ?? ""} /><span className="block text-xs font-normal text-muted-foreground">Aliases help match incoming notifications to this course.</span></label>
        <label className="block space-y-1.5 text-sm font-medium">Course color<select className="h-10 w-full rounded-lg border bg-background px-3 font-normal" defaultValue={course?.color ?? "blue"} name="color">{colors.map((color) => <option key={color} value={color}>{color.charAt(0).toUpperCase() + color.slice(1)}</option>)}</select></label>
        {error && <p aria-live="polite" className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="size-4" aria-hidden="true" />{error}</p>}
        <div className="flex justify-end gap-2 border-t pt-4"><Button onClick={onClose} type="button" variant="outline">Cancel</Button><Button disabled={pending} type="submit">{pending ? "Saving…" : course ? "Save course" : "Create course"}</Button></div>
      </form>
    </section>
  </div>;
}

export function CourseManager({ initialCourses }: { initialCourses: CourseRecord[] }) {
  const [courses, setCourses] = useState(initialCourses);
  const [selected, setSelected] = useState<CourseRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  useEffect(() => setCourses(initialCourses), [initialCourses]);

  function saved(result: CourseActionResult) {
    if (!result.success) return;
    setSelected(null);
    setCreating(false);
    router.refresh();
  }

  function remove(course: CourseRecord) {
    if (!window.confirm(`Delete ${course.name}? Existing tasks will remain without a course.`)) return;
    setError("");
    startTransition(async () => {
      const result = await deleteCourse(course.id);
      if (result.success) {
        setCourses((current) => current.filter((item) => item.id !== course.id));
        router.refresh();
      } else setError(result.error);
    });
  }

  return <>
    <div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{courses.length} {courses.length === 1 ? "course" : "courses"} in your workspace</p><Button className="gap-2" onClick={() => setCreating(true)}><Plus className="size-4" aria-hidden="true" />Add course</Button></div>
    {error && <p aria-live="polite" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    {courses.length ? <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{courses.map((course) => <li className="rounded-xl border bg-card p-5 shadow-sm" key={course.id}>
      <div className="flex items-start gap-3"><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${colorStyle[course.color as keyof typeof colorStyle] ?? colorStyle.slate}`}><BookOpen className="size-5" aria-hidden="true" /></span><div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{course.name}</h2><p className="mt-1 text-xs text-muted-foreground">{course.course_code || "No course code"}{course.instructor ? ` · ${course.instructor}` : ""}</p></div></div>
      <div className="mt-4 flex items-center justify-between"><span className="text-xs text-muted-foreground">{course.task_count} {course.task_count === 1 ? "task" : "tasks"}</span><span className="flex gap-1"><Button aria-label={`Edit ${course.name}`} onClick={() => setSelected(course)} size="icon" type="button" variant="ghost"><Pencil className="size-4" aria-hidden="true" /></Button><Button aria-label={`Delete ${course.name}`} disabled={pending} onClick={() => remove(course)} size="icon" type="button" variant="ghost"><Trash2 className="size-4 text-destructive" aria-hidden="true" /></Button></span></div>
      {course.aliases.length > 0 && <p className="mt-2 truncate text-xs text-muted-foreground" title={course.aliases.join(", ")}>Aliases: {course.aliases.join(", ")}</p>}
    </li>)}</ul> : <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border bg-card px-6 py-10 text-center"><span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"><BookOpen className="size-5" aria-hidden="true" /></span><h2 className="mt-4 font-medium">Add your courses</h2><p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">Course codes and aliases help UniTrack match new notifications accurately.</p><Button className="mt-4 gap-2" onClick={() => setCreating(true)}><Plus className="size-4" aria-hidden="true" />Add your first course</Button></div>}
    {(selected || creating) && <CourseEditor course={selected} onClose={() => { setSelected(null); setCreating(false); }} onSaved={saved} />}
  </>;
}
