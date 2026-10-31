import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { AcademicCalendar } from "@/components/calendar/academic-calendar";
import { AppShell } from "@/components/layout/app-shell";
import type { CourseOption } from "@/components/tasks/task-manager";
import { createClient } from "@/lib/supabase/server";
import type { TaskRecord } from "@/lib/tasks/schema";

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const loadDatedTasks = async () => {
    const rows: TaskRecord[] = [];
    for (let offset = 0; offset < 1_000_000; offset += 1000) {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, user_id, course_id, source_email_id, title, description, type, status, priority, due_at, source_url, needs_review, original_due_text, review_reasons, created_at, updated_at, courses(id, name, course_code), email_messages(id, sender, subject, received_at, gmail_url)")
        .eq("user_id", user.id)
        .not("due_at", "is", null)
        .order("due_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + 999);
      if (error) return { data: null, error };
      rows.push(...((data ?? []) as unknown as TaskRecord[]));
      if ((data ?? []).length < 1000) return { data: rows, error: null };
    }
    return { data: null, error: new Error("Calendar contains too many tasks to load.") };
  };

  const [taskResult, courseResult] = await Promise.all([
    loadDatedTasks(),
    supabase.from("courses").select("id, name, course_code").eq("user_id", user.id).order("name"),
  ]);

  return <AppShell activeSection="calendar" email={user.email ?? ""}>
    {(taskResult.error || courseResult.error) ? <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm" role="alert"><div className="flex items-center gap-2 font-medium text-destructive"><AlertCircle className="size-4" aria-hidden="true" />Calendar data could not be loaded</div><p className="mt-2 text-muted-foreground">Refresh to retry. Your records remain protected by account access policies.</p></div> : <AcademicCalendar tasks={(taskResult.data ?? []) as unknown as TaskRecord[]} courses={(courseResult.data ?? []) as CourseOption[]} />}
  </AppShell>;
}
