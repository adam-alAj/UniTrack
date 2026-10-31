import { handleIngestRequest } from "@/lib/ingest/handler";
import { createIngestionRepository } from "@/lib/ingest/repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleIngestRequest(request, {
    expectedSecret: process.env.UNITRACK_INGEST_SECRET,
    ownerUserId: process.env.UNITRACK_OWNER_USER_ID,
    sourceTimeZone: process.env.UNITRACK_SOURCE_TIMEZONE,
    getRepository: createIngestionRepository,
  });
}

function methodNotAllowed() {
  return Response.json(
    { success: false, status: "failed", error: "method_not_allowed" },
    { status: 405, headers: { allow: "POST", "cache-control": "no-store" } },
  );
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
