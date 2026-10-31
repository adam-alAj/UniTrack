import { z } from "zod";

export const InboundEmailSchema = z
  .object({
    schema_version: z.literal(1),
    source: z.literal("gmail_apps_script"),
    gmail_message_id: z.string().trim().min(1).max(512),
    gmail_thread_id: z.string().trim().min(1).max(512),
    sender: z.string().trim().min(1).max(512),
    subject: z.string().max(2000),
    received_at: z.string().datetime({ offset: true }),
    gmail_url: z
      .string()
      .url()
      .max(4096)
      .refine((value) => {
        try {
          return new URL(value).hostname === "mail.google.com";
        } catch {
          return false;
        }
      }),
    body_text: z.string().max(30000),
  })
  .strict();

export type InboundEmail = z.infer<typeof InboundEmailSchema>;
