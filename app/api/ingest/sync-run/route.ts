import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { handleSyncRunRequest } from "@/lib/sync/handler";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleSyncRunRequest(request, {
    expectedSecret: process.env.UNITRACK_INGEST_SECRET,
    ownerUserId: process.env.UNITRACK_OWNER_USER_ID,
    async recordRun(userId, run) {
      const supabase = createAdminClient();
      const { error } = await supabase.from("sync_runs").insert({
        user_id: userId,
        started_at: run.started_at,
        finished_at: run.finished_at,
        status: run.status,
        found_count: run.found_count,
        processed_count: run.processed_count,
        failed_count: run.failed_count,
        error_summary: run.error_summary,
      });
      if (error) throw new Error("Sync run persistence failed.");
    },
  });
}

function methodNotAllowed() {
  return Response.json({ success: false, error: "method_not_allowed" }, {
    status: 405,
    headers: { allow: "POST", "cache-control": "no-store" },
  });
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
