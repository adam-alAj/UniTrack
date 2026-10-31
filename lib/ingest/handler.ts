import { timingSafeEqual } from "node:crypto";

import { parseEmail } from "@/lib/email/parse";
import type { CourseDefinition } from "@/lib/email/types";
import { InboundEmailSchema } from "@/lib/ingest/schema";
import type {
  AtomicEmailInput,
  IngestionRepository,
  PersistedAnnouncement,
  PersistedTask,
} from "@/lib/ingest/types";

const MAX_REQUEST_BYTES = 256 * 1024;

export type IngestDependencies = {
  expectedSecret?: string;
  ownerUserId?: string;
  sourceTimeZone?: string;
  getRepository: () => IngestionRepository;
  logError?: (stage: string) => void;
};

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function constantTimeMatch(expected: string, provided: string): boolean {
  const expectedBytes = Buffer.from(expected, "utf8");
  const providedBytes = Buffer.from(provided, "utf8");
  return (
    expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes)
  );
}

function bearerToken(request: Request): string | null {
  const value = request.headers.get("authorization") ?? "";
  const match = value.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

async function readBoundedBody(request: Request): Promise<string | "too_large"> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_REQUEST_BYTES) return "too_large";
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_REQUEST_BYTES) {
      await reader.cancel();
      return "too_large";
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function prepareDatabaseRecords(
  email: ReturnType<typeof InboundEmailSchema.parse>,
  parsed: ReturnType<typeof parseEmail>,
): { processingStatus: "processed" | "needs_review"; tasks: PersistedTask[]; announcement: PersistedAnnouncement | null } {
  const tasks: PersistedTask[] = parsed.tasks.map((task) => ({
    title: task.title,
    description: task.description,
    type: task.type,
    course_id: task.courseId,
    due_at: task.dueAt,
    original_due_text: task.originalDueText,
    source_url: task.portalUrl,
    needs_review: task.needsReview,
    review_reasons: task.reviewReasons,
  }));

  const announcement = parsed.announcement
    ? {
        title: parsed.announcement.title,
        content: parsed.announcement.content,
        course_id: parsed.announcement.courseId,
        source_url: parsed.announcement.sourceUrl,
        received_at: email.received_at,
        needs_review: parsed.announcement.needsReview,
        review_reasons: parsed.announcement.reviewReasons,
      }
    : null;

  return {
    processingStatus:
      parsed.confidence === "low" || parsed.reviewReasons.length > 0 ||
      tasks.some((task) => task.needs_review) || Boolean(announcement?.needs_review)
        ? "needs_review"
        : "processed",
    tasks,
    announcement,
  };
}

function defaultLog(stage: string) {
  console.error(JSON.stringify({ event: "unitrack_ingest_error", stage, retryable: true }));
}

async function recordFailure(
  repository: IngestionRepository,
  userId: string,
  email: ReturnType<typeof InboundEmailSchema.parse>,
  stage: string,
) {
  try {
    await repository.recordFailure(userId, email, `Processing failed during ${stage}. Retry is safe.`);
  } catch {
    // The underlying persistence outage can also prevent the diagnostic row.
  }
}

export async function handleIngestRequest(
  request: Request,
  dependencies: IngestDependencies,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ success: false, status: "failed", error: "method_not_allowed" }, 405);
  }

  if (!dependencies.expectedSecret || !dependencies.ownerUserId) {
    return jsonResponse({ success: false, status: "failed", retryable: true, error: "server_not_configured" }, 503);
  }

  const providedSecret = bearerToken(request);
  if (!providedSecret || !constantTimeMatch(dependencies.expectedSecret, providedSecret)) {
    return jsonResponse({ success: false, status: "failed", error: "unauthorized" }, 401);
  }

  const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(dependencies.ownerUserId);
  if (!uuid) {
    return jsonResponse({ success: false, status: "failed", retryable: true, error: "server_not_configured" }, 503);
  }

  const contentType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return jsonResponse({ success: false, status: "failed", error: "unsupported_content_type" }, 415);
  }

  let body: string | "too_large";
  try {
    body = await readBoundedBody(request);
  } catch {
    return jsonResponse({ success: false, status: "failed", error: "invalid_body" }, 400);
  }
  if (body === "too_large") {
    return jsonResponse({ success: false, status: "failed", error: "payload_too_large" }, 413);
  }

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return jsonResponse({ success: false, status: "failed", error: "invalid_json" }, 400);
  }

  const validation = InboundEmailSchema.safeParse(json);
  if (!validation.success) {
    return jsonResponse({ success: false, status: "failed", error: "invalid_payload" }, 400);
  }

  const email = validation.data;
  const logError = dependencies.logError ?? defaultLog;
  let repository: IngestionRepository;

  try {
    repository = dependencies.getRepository();
    if (await repository.isDuplicate(dependencies.ownerUserId, email.gmail_message_id)) {
      return jsonResponse(
        { success: true, status: "duplicate", gmail_message_id: email.gmail_message_id },
        200,
      );
    }
  } catch {
    logError("database_lookup");
    return jsonResponse({ success: false, status: "failed", retryable: true }, 503);
  }

  let courses: CourseDefinition[];
  try {
    courses = await repository.listCourses(dependencies.ownerUserId);
  } catch {
    logError("course_lookup");
    await recordFailure(repository, dependencies.ownerUserId, email, "course lookup");
    return jsonResponse({ success: false, status: "failed", retryable: true }, 503);
  }

  let parsed: ReturnType<typeof parseEmail>;
  try {
    parsed = parseEmail(
      { subject: email.subject, body: email.body_text },
      { courses, sourceTimeZone: dependencies.sourceTimeZone },
    );
  } catch {
    logError("parse");
    await recordFailure(repository, dependencies.ownerUserId, email, "email parsing");
    return jsonResponse({ success: false, status: "failed", retryable: true }, 503);
  }

  const records = prepareDatabaseRecords(email, parsed);
  const atomicInput: AtomicEmailInput = {
    userId: dependencies.ownerUserId,
    email,
    processingStatus: records.processingStatus,
    reviewReasons: parsed.reviewReasons,
    tasks: records.tasks,
    announcement: records.announcement,
  };

  try {
    const status = await repository.persistAtomically(atomicInput);
    return jsonResponse(
      { success: true, status, gmail_message_id: email.gmail_message_id },
      200,
    );
  } catch {
    logError("database_persist");
    await recordFailure(repository, dependencies.ownerUserId, email, "database persistence");
    return jsonResponse(
      { success: false, status: "failed", retryable: true },
      503,
    );
  }
}
