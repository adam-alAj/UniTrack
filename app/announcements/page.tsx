import { redirect } from "next/navigation";
import { AlertCircle, Bell, ExternalLink, ShieldAlert } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { LocalDateTime } from "@/components/ui/local-date-time";
import { createClient } from "@/lib/supabase/server";

function safeSourceLink(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (
      url.hostname !== "mail.google.com" &&
      url.hostname !== "mail.googleusercontent.com"
    )
      return url.toString();
    return url.hostname === "mail.google.com" ? url.toString() : null;
  } catch {
    return null;
  }
}

function oneRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export default async function AnnouncementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("announcements")
    .select(
      "id, title, content, source_url, received_at, needs_review, review_reasons, courses(name, course_code), email_messages(sender, subject, gmail_url)",
    )
    .eq("user_id", user.id)
    .order("received_at", { ascending: false, nullsFirst: false })
    .limit(100);

  return (
    <AppShell activeSection="announcements" email={user.email ?? ""}>
      {error ? (
        <div
          className="border-destructive/30 bg-destructive/5 rounded-xl border p-5 text-sm"
          role="alert"
        >
          <div className="text-destructive flex items-center gap-2 font-medium">
            <AlertCircle className="size-4" aria-hidden="true" />
            Announcements could not be loaded
          </div>
          <p className="text-muted-foreground mt-2">
            Refresh the page to try again.
          </p>
        </div>
      ) : data?.length ? (
        <ul className="space-y-3">
          {data.map((announcement) => {
            const sourceEmail = oneRelation<{
              sender: string;
              subject: string | null;
              gmail_url: string | null;
            }>(announcement.email_messages);
            const course = oneRelation<{
              name: string;
              course_code: string | null;
            }>(announcement.courses);
            const emailUrl = safeSourceLink(
              sourceEmail?.gmail_url ?? null,
            );
            const sourceUrl =
              emailUrl ?? safeSourceLink(announcement.source_url);
            return (
              <li
                className="bg-card rounded-xl border p-5 shadow-sm sm:p-6"
                key={announcement.id}
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <Bell className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold">
                        {announcement.title}
                      </h2>
                      {announcement.needs_review && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                          <ShieldAlert className="size-3" aria-hidden="true" />
                          Review
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {course?.course_code ||
                        course?.name ||
                        "Course not matched"}{" "}
                      ·{" "}
                      <LocalDateTime
                        fallback="Received date unavailable"
                        value={announcement.received_at}
                      />
                    </p>
                    {announcement.content && (
                      <p className="text-foreground/85 mt-4 text-sm leading-6 whitespace-pre-wrap">
                        {announcement.content}
                      </p>
                    )}
                    {sourceEmail && (
                      <p className="text-muted-foreground mt-3 text-xs">
                        From {sourceEmail.sender}
                        {sourceEmail.subject
                          ? ` · ${sourceEmail.subject}`
                          : ""}
                      </p>
                    )}
                    {sourceUrl && (
                      <a
                        className="text-primary mt-4 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                        href={sourceUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {emailUrl ? "Open original email" : "Open source link"}
                        <ExternalLink className="size-4" aria-hidden="true" />
                      </a>
                    )}
                    {announcement.review_reasons?.length > 0 && (
                      <p className="mt-2 text-xs text-amber-900">
                        Review:{" "}
                        {announcement.review_reasons
                          .map((reason: string) => reason.replaceAll("_", " "))
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="bg-card flex min-h-72 flex-col items-center justify-center rounded-xl border px-6 py-10 text-center">
          <span className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-xl">
            <Bell className="size-5" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-medium">No announcements yet</h2>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm leading-6">
            Course announcements from processed emails will appear here.
          </p>
        </div>
      )}
    </AppShell>
  );
}
