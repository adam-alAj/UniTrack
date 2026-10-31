import { z } from "zod";

export const TaskInputSchema = z
  .object({
    title: z.string().trim().min(1, "Add a task title.").max(500),
    description: z.string().trim().max(20_000).nullable(),
    course_id: z.string().uuid().nullable(),
    type: z.enum(["assignment", "quiz", "exam", "other"]),
    status: z.enum(["not_started", "in_progress", "completed"]),
    due_at: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

export const TaskUpdateSchema = TaskInputSchema.extend({
  id: z.string().uuid(),
}).strict();
export type TaskInput = z.infer<typeof TaskInputSchema>;

export type TaskRecord = TaskInput & {
  id: string;
  user_id: string;
  priority: "low" | "medium" | "high";
  source_email_id: string | null;
  source_url: string | null;
  needs_review: boolean;
  original_due_text: string | null;
  review_reasons: string[];
  created_at: string;
  updated_at: string;
  courses: { id: string; name: string; course_code: string | null } | null;
  email_messages: {
    id: string;
    sender: string;
    subject: string | null;
    received_at: string | null;
    gmail_url: string | null;
  } | null;
};

export type TaskActionResult =
  { success: true } | { success: false; error: string };
