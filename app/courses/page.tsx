import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { CourseManager } from "@/components/courses/course-manager";
import { AppShell } from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";
import type { CourseRecord } from "@/lib/courses/schema";

export default async function CoursesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("courses")
    .select(
      "id, user_id, name, course_code, instructor, aliases, color, created_at",
    )
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  const withCounts =
    !error && data
      ? await Promise.all(
          data.map(async (course) => {
            const count = await supabase
              .from("tasks")
              .select("id", { count: "exact", head: true })
              .eq("user_id", user.id)
              .eq("course_id", course.id);
            return {
              course,
              task_count: count.count ?? 0,
              countFailed: Boolean(count.error),
            };
          }),
        )
      : [];
  const countError = withCounts.some((item) => item.countFailed);
  const courses = withCounts.map(({ course, task_count }) => ({
    ...course,
    task_count,
  })) as unknown as CourseRecord[];

  return (
    <AppShell activeSection="courses" email={user.email ?? ""}>
      {error || countError ? (
        <div
          className="border-destructive/30 bg-destructive/5 rounded-xl border p-5 text-sm"
          role="alert"
        >
          <div className="text-destructive flex items-center gap-2 font-medium">
            <AlertCircle className="size-4" aria-hidden="true" />
            Course data could not be loaded
          </div>
          <p className="text-muted-foreground mt-2">
            Refresh to retry. Course and task records remain protected by
            account access policies.
          </p>
        </div>
      ) : (
        <CourseManager initialCourses={courses} />
      )}
    </AppShell>
  );
}
