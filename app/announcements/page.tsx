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
    if (url.hostname !== "mail.google.com" && url.hostname !== "mail.googleusercontent.com") return url.toString();
    return url.hostname === "mail.google.com" ? url.toString() : null;
  } catch {
    return null;
  }
}

export default async function AnnouncementsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, content, source_url, received_at, needs_review, review_reasons, courses(name, course_code), email_messages(sender, subject, gmail_url)")
    .eq("user_id", user.id)
    .order("received_at", { ascending: false, nullsFirst: false })
    .limit(100);

  return <AppShell activeSection="announcements" email={user.email ?? ""}>
    {error ? <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm" role="alert"><div className="flex items-center gap-2 font-medium text-destructive"><AlertCircle className="size-4" aria-hidden="true" />Announcements could not be loaded</div><p className="mt-2 text-muted-foreground">Refresh the page to try again.</p></div> : data?.length ? <ul className="space-y-3">{data.map((announcement) => {
      const emailUrl = safeSourceLink(announcement.email_messages?.gmail_url ?? null);
      const sourceUrl = emailUrl ?? safeSourceLink(announcement.source_url);
      return <li className="rounded-xl border bg-card p-5 shadow-sm sm:p-6" key={announcement.id}>
        <div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Bell className="size-5" aria-hidden="true" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold">{announcement.title}</h2>{announcement.needs_review && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900"><ShieldAlert className="size-3" aria-hidden="true" />Review</span>}</div>
          <p className="mt-1 text-xs text-muted-foreground">{announcement.courses?.course_code || announcement.courses?.name || "Course not matched"} · <LocalDateTime fallback="Received date unavailable" value={announcement.received_at} /></p>
          {announcement.content && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground/85">{announcement.content}</p>}
          {announcement.email_messages && <p className="mt-3 text-xs text-muted-foreground">From {announcement.email_messages.sender}{announcement.email_messages.subject ? ` · ${announcement.email_messages.subject}` : ""}</p>}
          {sourceUrl && <a className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline" href={sourceUrl} rel="noopener noreferrer" target="_blank">{emailUrl ? "Open original email" : "Open source link"}<ExternalLink className="size-4" aria-hidden="true" /></a>}
          {announcement.review_reasons?.length > 0 && <p className="mt-2 text-xs text-amber-900">Review: {announcement.review_reasons.map((reason: string) => reason.replaceAll("_", " ")).join(" · ")}</p>}
        </div></div>
      </li>;
    })}</ul> : <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border bg-card px-6 py-10 text-center"><span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Bell className="size-5" aria-hidden="true" /></span><h2 className="mt-4 font-medium">No announcements yet</h2><p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">Course announcements from processed emails will appear here.</p></div>}
  </AppShell>;
}
