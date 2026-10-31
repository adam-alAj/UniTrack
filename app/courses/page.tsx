import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { CourseManager } from "@/components/courses/course-manager";
import { AppShell } from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";
import type { CourseRecord } from "@/lib/courses/schema";

export default async function CoursesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("courses")
    .select("id, user_id, name, course_code, instructor, aliases, color, created_at")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  let courses: CourseRecord[] = [];
  let countError = false;
  if (!error && data) {
    const withCounts = await Promise.all(data.map(async (course) => {
      const count = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("course_id", course.id);
      if (count.error) countError = true;
      return { ...course, task_count: count.count ?? 0 };
    }));
    courses = withCounts as unknown as CourseRecord[];
  }

  return <AppShell activeSection="courses" email={user.email ?? ""}>
    {(error || countError) ? <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm" role="alert"><div className="flex items-center gap-2 font-medium text-destructive"><AlertCircle className="size-4" aria-hidden="true" />Course data could not be loaded</div><p className="mt-2 text-muted-foreground">Refresh to retry. Course and task records remain protected by account access policies.</p></div> : <CourseManager initialCourses={courses} />}
  </AppShell>;
}
