import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { Overview } from "@/components/dashboard/overview";
import type { TaskRecord } from "@/lib/tasks/schema";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const now = new Date();
  const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [futureTasks, undatedTasks, overdueTasks, announcementResult, syncResult, pendingCount, dueSoonCount, examCount, completedCount, overdueCount] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, type, status, due_at, needs_review, courses(name, course_code)")
      .eq("user_id", user.id)
      .neq("status", "completed")
      .gte("due_at", now.toISOString())
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(6),
    supabase
      .from("tasks")
      .select("id, title, type, status, due_at, needs_review, courses(name, course_code)")
      .eq("user_id", user.id)
      .neq("status", "completed")
      .is("due_at", null)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("tasks")
      .select("id, title, type, status, due_at, needs_review, courses(name, course_code)")
      .eq("user_id", user.id)
      .neq("status", "completed")
      .lt("due_at", now.toISOString())
      .order("due_at", { ascending: true })
      .limit(5),
    supabase
      .from("announcements")
      .select("id, title, content, received_at, needs_review, courses(name, course_code)")
      .eq("user_id", user.id)
      .order("received_at", { ascending: false, nullsFirst: false })
      .limit(5),
    supabase
      .from("sync_runs")
      .select("status, started_at, finished_at, found_count, processed_count, failed_count")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id).neq("status", "completed"),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id).neq("status", "completed").gte("due_at", now.toISOString()).lte("due_at", week.toISOString()),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("type", "exam").neq("status", "completed").gte("due_at", now.toISOString()),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "completed"),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id).neq("status", "completed").lt("due_at", now.toISOString()),
  ]);

  const failed = Boolean(futureTasks.error || undatedTasks.error || overdueTasks.error || announcementResult.error || syncResult.error || pendingCount.error || dueSoonCount.error || examCount.error || completedCount.error || overdueCount.error);
  const tasks = [...(futureTasks.data ?? []), ...(undatedTasks.data ?? []), ...(overdueTasks.data ?? [])] as unknown as TaskRecord[];

  return (
    <AppShell activeSection="overview" email={user.email ?? ""}>
      <Overview
        tasks={tasks}
        announcements={(announcementResult.data ?? []) as unknown as Parameters<typeof Overview>[0]["announcements"]}
        latestSync={syncResult.data}
        queryFailed={failed}
        counts={{ pending: pendingCount.count, dueSoon: dueSoonCount.count, exams: examCount.count, completed: completedCount.count, overdue: overdueCount.count }}
      />
    </AppShell>
  );
}
