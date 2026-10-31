import { timingSafeEqual } from "node:crypto";

import { SyncRunSchema } from "@/lib/sync/schema";
import type { SyncRunInput } from "@/lib/sync/schema";

const MAX_BODY_BYTES = 8 * 1024;

export type SyncRunDependencies = {
  expectedSecret?: string;
  ownerUserId?: string;
  recordRun: (ownerUserId: string, run: SyncRunInput) => Promise<void>;
};

function json(body: Record<string, unknown>, status: number) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function matchesSecret(expected: string, provided: string) {
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(provided, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

async function readBody(request: Request) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
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

export async function handleSyncRunRequest(
  request: Request,
  dependencies: SyncRunDependencies,
) {
  if (request.method !== "POST")
    return json({ success: false, error: "method_not_allowed" }, 405);
  if (!dependencies.expectedSecret || !dependencies.ownerUserId)
    return json({ success: false, error: "server_not_configured" }, 503);
  if (
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
      dependencies.ownerUserId,
    )
  ) {
    return json({ success: false, error: "server_not_configured" }, 503);
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  if (!token || !matchesSecret(dependencies.expectedSecret, token))
    return json({ success: false, error: "unauthorized" }, 401);
  if (
    (request.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase() !== "application/json"
  ) {
    return json({ success: false, error: "unsupported_content_type" }, 415);
  }

  let body: string | null;
  try {
    body = await readBody(request);
  } catch {
    return json({ success: false, error: "invalid_body" }, 400);
  }
  if (body === null)
    return json({ success: false, error: "payload_too_large" }, 413);

  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return json({ success: false, error: "invalid_json" }, 400);
  }
  const parsed = SyncRunSchema.safeParse(value);
  if (!parsed.success)
    return json({ success: false, error: "invalid_payload" }, 400);

  try {
    await dependencies.recordRun(dependencies.ownerUserId, parsed.data);
    return json({ success: true, status: "recorded" }, 201);
  } catch {
    return json({ success: false, retryable: true }, 503);
  }
}
