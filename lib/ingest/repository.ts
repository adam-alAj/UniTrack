import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { AtomicEmailInput, IngestionRepository } from "@/lib/ingest/types";

export function createIngestionRepository(): IngestionRepository {
  const supabase = createAdminClient();

  return {
    async isDuplicate(userId, gmailMessageId) {
      const { data, error } = await supabase
        .from("email_messages")
        .select("processing_status")
        .eq("user_id", userId)
        .eq("gmail_message_id", gmailMessageId)
        .maybeSingle();
      if (error) throw new Error("Email idempotency lookup failed.");
      return Boolean(data && data.processing_status !== "failed");
    },

    async listCourses(userId) {
      const { data, error } = await supabase
        .from("courses")
        .select("id, name, course_code, aliases")
        .eq("user_id", userId);
      if (error) throw new Error("Course lookup failed.");
      return (data ?? []).map((course) => ({
        id: course.id,
        name: course.name,
        course_code: course.course_code,
        aliases: course.aliases ?? [],
      }));
    },

    async persistAtomically(input: AtomicEmailInput) {
      const { data, error } = await supabase.rpc("ingest_email_message", {
        p_user_id: input.userId,
        p_gmail_message_id: input.email.gmail_message_id,
        p_gmail_thread_id: input.email.gmail_thread_id,
        p_sender: input.email.sender,
        p_subject: input.email.subject,
        p_received_at: input.email.received_at,
        p_gmail_url: input.email.gmail_url,
        p_body_text: input.email.body_text,
        p_processing_status: input.processingStatus,
        p_review_reasons: input.reviewReasons,
        p_tasks: input.tasks,
        p_announcement: input.announcement,
      });

      if (error || (data !== "processed" && data !== "needs_review" && data !== "duplicate")) {
        throw new Error("Atomic email persistence failed.");
      }
      return data;
    },

    async recordFailure(userId, email, reason) {
      const { error } = await supabase.rpc("record_email_processing_failure", {
        p_user_id: userId,
        p_gmail_message_id: email.gmail_message_id,
        p_gmail_thread_id: email.gmail_thread_id,
        p_sender: email.sender,
        p_subject: email.subject,
        p_received_at: email.received_at,
        p_gmail_url: email.gmail_url,
        p_body_text: email.body_text,
        p_processing_error: reason,
      });
      if (error) throw new Error("Could not record processing failure.");
    },
  };
}
