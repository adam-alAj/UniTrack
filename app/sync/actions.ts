"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";

import { handleIngestRequest } from "@/lib/ingest/handler";
import { createIngestionRepository } from "@/lib/ingest/repository";
import { InboundEmailSchema } from "@/lib/ingest/schema";
import { createClient } from "@/lib/supabase/server";

export type RetryMessageResult =
  { success: true; status: string } | { success: false; error: string };

export async function retryFailedMessage(
  emailIdValue: string,
): Promise<RetryMessageResult> {
  const emailId = z.string().uuid().safeParse(emailIdValue);
  if (!emailId.success)
    return { success: false, error: "This message cannot be retried." };

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    return {
      success: false,
      error: "Your session expired. Sign in and try again.",
    };

  const { data: message, error } = await supabase
    .from("email_messages")
    .select(
      "gmail_message_id, gmail_thread_id, sender, subject, received_at, gmail_url, body_text, processing_status",
    )
    .eq("id", emailId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !message || message.processing_status !== "failed") {
    return {
      success: false,
      error: "Only an owned message marked failed can be retried.",
    };
  }

  const payload = InboundEmailSchema.safeParse({
    schema_version: 1,
    source: "gmail_apps_script",
    gmail_message_id: message.gmail_message_id,
    gmail_thread_id: message.gmail_thread_id,
    sender: message.sender,
    subject: message.subject ?? "",
    received_at: message.received_at,
    gmail_url: message.gmail_url,
    body_text: message.body_text,
  });
  if (!payload.success)
    return {
      success: false,
      error: "The saved message is missing data required for a safe retry.",
    };

  const internalSecret = randomBytes(32).toString("hex");
  const response = await handleIngestRequest(
    new Request("https://unitrack.internal/api/ingest/email", {
      method: "POST",
      headers: {
        authorization: `Bearer ${internalSecret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload.data),
    }),
    {
      expectedSecret: internalSecret,
      ownerUserId: user.id,
      sourceTimeZone: process.env.UNITRACK_SOURCE_TIMEZONE,
      getRepository: createIngestionRepository,
    },
  );

  const result = (await response.json()) as {
    success?: boolean;
    status?: string;
  };
  if (!result.success || !result.status)
    return {
      success: false,
      error:
        "Retry did not complete. The failed message remains available to try again.",
    };
  return { success: true, status: result.status };
}
