import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import {
  SyncMonitor,
  type EmailProcessingView,
  type SyncRunView,
} from "@/components/sync/sync-monitor";
import { createClient } from "@/lib/supabase/server";

export default async function SyncPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    runs,
    messages,
    processedCount,
    reviewCount,
    failedCount,
    lastSuccessful,
  ] = await Promise.all([
    supabase
      .from("sync_runs")
      .select(
        "id, started_at, finished_at, status, found_count, processed_count, failed_count, error_summary",
      )
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(20),
    supabase
      .from("email_messages")
      .select(
        "id, sender, subject, received_at, gmail_url, processing_status, processing_error, review_reasons",
      )
      .eq("user_id", user.id)
      .in("processing_status", ["failed", "needs_review", "received"])
      .order("received_at", { ascending: false, nullsFirst: false })
      .limit(50),
    supabase
      .from("email_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("processing_status", "processed"),
    supabase
      .from("email_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("processing_status", "needs_review"),
    supabase
      .from("email_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("processing_status", "failed"),
    supabase
      .from("sync_runs")
      .select("finished_at")
      .eq("user_id", user.id)
      .eq("status", "success")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const failed = Boolean(
    runs.error ||
    messages.error ||
    processedCount.error ||
    reviewCount.error ||
    failedCount.error ||
    lastSuccessful.error,
  );
  const runViews = (runs.data ?? []).map((run) => ({
    ...run,
    error_summary: run.error_summary
      ? "The worker reported one or more failures."
      : null,
  })) as unknown as SyncRunView[];
  const messageViews = (messages.data ?? []).map((item) => ({
    ...item,
    processing_error: item.processing_error
      ?.toLowerCase()
      .includes("course lookup")
      ? "Course data was unavailable during processing."
      : item.processing_error?.toLowerCase().includes("parsing")
        ? "The message could not be parsed; its original content is retained for a safe retry."
        : item.processing_error?.toLowerCase().includes("database persistence")
          ? "The database did not save this message. Retrying is safe."
          : item.processing_error
            ? "Processing did not complete. Retrying is safe."
            : null,
  })) as unknown as EmailProcessingView[];

  return (
    <AppShell activeSection="sync" email={user.email ?? ""}>
      {failed && (
        <div
          className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Some synchronization data could not be loaded. Affected counts may
            appear unavailable.
          </span>
        </div>
      )}
      <SyncMonitor
        runs={runViews}
        messages={messageViews}
        processedCount={processedCount.count}
        reviewCount={reviewCount.count}
        failedCount={failedCount.count}
        lastSuccessfulAt={lastSuccessful.data?.finished_at ?? null}
      />
    </AppShell>
  );
}
