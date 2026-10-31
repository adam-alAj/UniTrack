import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { TaskManager } from "@/components/tasks/task-manager";
import { createClient } from "@/lib/supabase/server";
import type { TaskRecord } from "@/lib/tasks/schema";

export default async function TasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const loadTasks = async () => {
    const rows: TaskRecord[] = [];
    for (let offset = 0; offset < 1_000_000; offset += 1000) {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, user_id, course_id, source_email_id, title, description, type, status, priority, due_at, source_url, needs_review, original_due_text, review_reasons, created_at, updated_at, courses(id, name, course_code), email_messages(id, sender, subject, received_at, gmail_url)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + 999);
      if (error) return { data: null, error };
      rows.push(...((data ?? []) as unknown as TaskRecord[]));
      if ((data ?? []).length < 1000) return { data: rows, error: null };
    }
    return { data: null, error: new Error("Task list exceeded the maximum supported size.") };
  };

  const [tasksResult, coursesResult] = await Promise.all([
    loadTasks(),
    supabase
      .from("courses")
      .select("id, name, course_code")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
  ]);

  return (
    <AppShell activeSection="tasks" email={user.email ?? ""}>
      {(tasksResult.error || coursesResult.error) ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm" role="alert">
          <div className="flex items-center gap-2 font-medium text-destructive"><AlertCircle className="size-4" aria-hidden="true" />Tasks could not be loaded</div>
          <p className="mt-2 text-muted-foreground">Refresh the page to try again. Your account data remains protected by Supabase access policies.</p>
        </div>
      ) : (
        <TaskManager
          initialTasks={(tasksResult.data ?? []) as unknown as TaskRecord[]}
          courses={(coursesResult.data ?? []) as { id: string; name: string; course_code: string | null }[]}
        />
      )}
    </AppShell>
  );
}
