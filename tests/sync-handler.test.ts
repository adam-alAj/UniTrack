import assert from "node:assert/strict";
import test from "node:test";

import { handleSyncRunRequest } from "@/lib/sync/handler";

const ownerId = "123e4567-e89b-12d3-a456-426614174000";
const secret = "test-secret-only";
const syncRun = {
  started_at: "2026-10-31T10:00:00.000Z",
  finished_at: "2026-10-31T10:00:20.000Z",
  status: "partial",
  found_count: 4,
  processed_count: 3,
  failed_count: 1,
  error_summary: "One or more messages could not be delivered.",
};

function makeRequest(value: unknown, authorization = `Bearer ${secret}`) {
  return new Request("https://unitrack.example/api/ingest/sync-run", {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify(value),
  });
}

test("sync run endpoint rejects bad bearer secrets and caller ownership", async () => {
  const recordRun = async () => {};
  const invalidSecret = await handleSyncRunRequest(makeRequest(syncRun, "Bearer wrong"), { expectedSecret: secret, ownerUserId: ownerId, recordRun });
  const forgedOwner = await handleSyncRunRequest(makeRequest({ ...syncRun, user_id: ownerId }), { expectedSecret: secret, ownerUserId: ownerId, recordRun });
  assert.equal(invalidSecret.status, 401);
  assert.equal(forgedOwner.status, 400);
});

test("sync run is stored against server-configured owner with validated counts", async () => {
  let recordedOwner = "";
  let recordedCount = 0;
  const response = await handleSyncRunRequest(makeRequest(syncRun), {
    expectedSecret: secret,
    ownerUserId: ownerId,
    recordRun: async (userId, run) => {
      recordedOwner = userId;
      recordedCount = run.found_count;
    },
  });
  assert.equal(response.status, 201);
  assert.equal(recordedOwner, ownerId);
  assert.equal(recordedCount, 4);
});

test("sync run requires a valid time interval and integer counters", async () => {
  const dependencies = { expectedSecret: secret, ownerUserId: ownerId, recordRun: async () => {} };
  const invalidInterval = await handleSyncRunRequest(makeRequest({ ...syncRun, finished_at: "2026-10-31T09:59:00.000Z" }), dependencies);
  const invalidCount = await handleSyncRunRequest(makeRequest({ ...syncRun, failed_count: -1 }), dependencies);
  assert.equal(invalidInterval.status, 400);
  assert.equal(invalidCount.status, 400);
});
