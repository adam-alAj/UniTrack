"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Clock3, ExternalLink, Mail, RotateCw, ShieldAlert, XCircle } from "lucide-react";

import { retryFailedMessage } from "@/app/sync/actions";
import { Button } from "@/components/ui/button";

export type SyncRunView = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "partial" | "failed";
  found_count: number;
  processed_count: number;
  failed_count: number;
  error_summary: string | null;
};

export type EmailProcessingView = {
  id: string;
  sender: string;
  subject: string | null;
  received_at: string | null;
  gmail_url: string | null;
  processing_status: "received" | "needs_review" | "failed";
  processing_error: string | null;
  review_reasons: string[];
};

function localDate(value: string | null) {
  if (!value) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function safeGmailUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "mail.google.com" ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeFailureMessage(value: string | null) {
  if (!value) return "Processing did not complete. Retry uses the same Gmail message ID.";
  if (/course lookup/i.test(value)) return "Course data was unavailable during processing.";
  if (/parsing/i.test(value)) return "The message could not be parsed; its original content is retained for a safe retry.";
  if (/database persistence/i.test(value)) return "The database did not save this message. Retrying is safe.";
  return "Processing did not complete. Retrying is safe.";
}

function statusPresentation(status: SyncRunView["status"]) {
  if (status === "success") return { label: "Successful", style: "bg-emerald-50 text-emerald-800", Icon: CheckCircle2 };
  if (status === "running") return { label: "Running", style: "bg-blue-50 text-blue-800", Icon: Clock3 };
  if (status === "partial") return { label: "Partial", style: "bg-amber-50 text-amber-900", Icon: AlertCircle };
  return { label: "Failed", style: "bg-rose-50 text-rose-800", Icon: XCircle };
}

export function SyncMonitor({
  runs,
  messages,
  processedCount,
  reviewCount,
  failedCount,
  lastSuccessfulAt,
}: {
  runs: SyncRunView[];
  messages: EmailProcessingView[];
  processedCount: number | null;
  reviewCount: number | null;
  failedCount: number | null;
  lastSuccessfulAt: string | null;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function retry(id: string) {
    setPendingId(id);
    setMessage(null);
    startTransition(async () => {
      const result = await retryFailedMessage(id);
      setPendingId(null);
      setMessage({ id, text: result.success ? `Retry completed: ${result.status.replaceAll("_", " ")}.` : result.error, error: !result.success });
      if (result.success) router.refresh();
    });
  }

  return <>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-xl border bg-card p-4"><p className="text-xs font-medium text-muted-foreground">Last successful sync</p><p className="mt-2 text-sm font-semibold">{lastSuccessfulAt ? localDate(lastSuccessfulAt) : "No successful run yet"}</p></article>
      <article className="rounded-xl border bg-card p-4"><p className="text-xs font-medium text-muted-foreground">Processed messages</p><p className="mt-2 text-2xl font-semibold">{processedCount ?? "—"}</p></article>
      <article className="rounded-xl border bg-card p-4"><p className="text-xs font-medium text-muted-foreground">Needs review</p><p className="mt-2 text-2xl font-semibold">{reviewCount ?? "—"}</p></article>
      <article className="rounded-xl border bg-card p-4"><p className="text-xs font-medium text-muted-foreground">Failed processing</p><p className="mt-2 text-2xl font-semibold">{failedCount ?? "—"}</p></article>
    </section>

    <section className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b px-5 py-4"><h2 className="font-semibold">Recent synchronization runs</h2><p className="mt-1 text-xs text-muted-foreground">Counts are reported by the Apps Script worker after each completed run.</p></div>
      {runs.length ? <ul className="divide-y">{runs.map((run) => {
        const presentation = statusPresentation(run.status);
        const Icon = presentation.Icon;
        return <li className="flex flex-wrap items-center gap-3 px-5 py-4" key={run.id}>
          <span className={`flex size-9 items-center justify-center rounded-lg ${presentation.style}`}><Icon className="size-4" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1"><p className="text-sm font-medium">{presentation.label} · {localDate(run.started_at)}</p><p className="mt-1 text-xs text-muted-foreground">{run.found_count} found · {run.processed_count} accepted · {run.failed_count} failed{run.finished_at ? ` · finished ${localDate(run.finished_at)}` : " · finish time unavailable"}</p>{run.error_summary && <p className="mt-1 text-xs text-amber-900">{run.error_summary}</p>}</div>
        </li>;
      })}</ul> : <div className="flex min-h-36 flex-col items-center justify-center px-6 text-center"><Clock3 className="size-5 text-muted-foreground" aria-hidden="true" /><p className="mt-3 text-sm font-medium">No sync history recorded</p><p className="mt-1 text-xs text-muted-foreground">A run appears after the configured worker reports its results.</p></div>}
    </section>

    <section className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b px-5 py-4"><h2 className="font-semibold">Messages requiring attention</h2><p className="mt-1 text-xs text-muted-foreground">Private message bodies are not shown here.</p></div>
      {messages.length ? <ul className="divide-y">{messages.map((item) => {
        const isFailed = item.processing_status === "failed";
        const gmailUrl = safeGmailUrl(item.gmail_url);
        return <li className="px-5 py-4" key={item.id}>
          <div className="flex flex-wrap items-start gap-3"><span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${isFailed ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-900"}`}>{isFailed ? <XCircle className="size-4" aria-hidden="true" /> : <ShieldAlert className="size-4" aria-hidden="true" />}</span>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="max-w-full truncate text-sm font-medium">{item.subject || "(No subject)"}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isFailed ? "bg-rose-50 text-rose-800" : "bg-amber-100 text-amber-900"}`}>{item.processing_status.replaceAll("_", " ")}</span></div><p className="mt-1 break-all text-xs text-muted-foreground">{item.sender} · {localDate(item.received_at)}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{isFailed ? safeFailureMessage(item.processing_error) : item.review_reasons.length ? item.review_reasons.map((reason) => reason.replaceAll("_", " ")).join(" · ") : "Check the extracted course and task details."}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">{gmailUrl && <a className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" href={gmailUrl} rel="noopener noreferrer" target="_blank">Open original email <ExternalLink className="size-3.5" aria-hidden="true" /></a>}{isFailed && <Button className="h-8 gap-1.5 px-3 text-xs" disabled={pending && pendingId === item.id} onClick={() => retry(item.id)} type="button" variant="outline"><RotateCw className="size-3.5" aria-hidden="true" />{pending && pendingId === item.id ? "Retrying…" : "Retry processing"}</Button>}</div>
              {message?.id === item.id && <p aria-live="polite" className={`mt-2 text-xs ${message.error ? "text-destructive" : "text-emerald-800"}`}>{message.text}</p>}
            </div>
          </div>
        </li>;
      })}</ul> : <div className="flex min-h-36 flex-col items-center justify-center px-6 text-center"><Mail className="size-5 text-muted-foreground" aria-hidden="true" /><p className="mt-3 text-sm font-medium">No messages need attention</p><p className="mt-1 text-xs text-muted-foreground">Failed and review-required emails will be listed here.</p></div>}
    </section>
  </>;
}
