import type { CourseDefinition, ParseResult } from "@/lib/email/types";
import type { InboundEmail } from "@/lib/ingest/schema";

export type PersistedTask = {
  title: string;
  description: string | null;
  type: "assignment" | "quiz" | "exam";
  course_id: string | null;
  due_at: string | null;
  original_due_text: string | null;
  source_url: string | null;
  needs_review: boolean;
  review_reasons: string[];
};

export type PersistedAnnouncement = {
  title: string;
  content: string | null;
  course_id: string | null;
  source_url: string | null;
  received_at: string | null;
  needs_review: boolean;
  review_reasons: string[];
};

export type AtomicEmailInput = {
  userId: string;
  email: InboundEmail;
  processingStatus: "processed" | "needs_review";
  reviewReasons: string[];
  tasks: PersistedTask[];
  announcement: PersistedAnnouncement | null;
};

export interface IngestionRepository {
  isDuplicate(userId: string, gmailMessageId: string): Promise<boolean>;
  listCourses(userId: string): Promise<CourseDefinition[]>;
  persistAtomically(
    input: AtomicEmailInput,
  ): Promise<"processed" | "needs_review" | "duplicate">;
  recordFailure(
    userId: string,
    email: InboundEmail,
    reason: string,
  ): Promise<void>;
}

export type PreparedEmail = {
  email: InboundEmail;
  parsed: ParseResult;
  processingStatus: "processed" | "needs_review";
  tasks: PersistedTask[];
  announcement: PersistedAnnouncement | null;
};
