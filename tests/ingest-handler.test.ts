import assert from "node:assert/strict";
import test from "node:test";

import { handleIngestRequest } from "@/lib/ingest/handler";
import type { IngestionRepository } from "@/lib/ingest/types";

const OWNER_ID = "123e4567-e89b-12d3-a456-426614174000";
const SECRET = "test-only-secret-value";

function validPayload() {
  return {
    schema_version: 1,
    source: "gmail_apps_script",
    gmail_message_id: "test-message-id",
    gmail_thread_id: "test-thread-id",
    sender: "Test Sender <sender@example.invalid>",
    subject: "Quiz: [REDACTED]",
    received_at: "2026-01-02T03:04:05.000Z",
    gmail_url: "https://mail.google.com/mail/u/0/#all/test-message-id",
    body_text: "Quiz [REDACTED]",
  };
}

function fakeRepository(overrides: Partial<IngestionRepository> = {}) {
  const calls = { duplicate: 0, courses: 0, persist: 0 };
  const repository: IngestionRepository = {
    isDuplicate: async () => {
      calls.duplicate += 1;
      return false;
    },
    listCourses: async () => {
      calls.courses += 1;
      return [];
    },
    persistAtomically: async () => {
      calls.persist += 1;
      return "needs_review";
    },
    ...overrides,
  };
  return { repository, calls };
}

function request(
  body: unknown,
  options: { method?: string; authorization?: string; contentType?: string } = {},
) {
  return new Request("https://unitrack.example/api/ingest/email", {
    method: options.method ?? "POST",
    headers: {
      authorization: options.authorization ?? `Bearer ${SECRET}`,
      "content-type": options.contentType ?? "application/json",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function dependencies(repository: IngestionRepository, logError = () => {}) {
  return {
    expectedSecret: SECRET,
    ownerUserId: OWNER_ID,
    getRepository: () => repository,
    logError,
  };
}

test("rejects missing/invalid bearer secrets and non-POST requests", async () => {
  const { repository } = fakeRepository();
  const missing = await handleIngestRequest(request(validPayload(), { authorization: "" }), dependencies(repository));
  const invalid = await handleIngestRequest(request(validPayload(), { authorization: "Bearer wrong" }), dependencies(repository));
  const method = await handleIngestRequest(request(validPayload(), { method: "PUT" }), dependencies(repository));

  assert.equal(missing.status, 401);
  assert.equal(invalid.status, 401);
  assert.equal(method.status, 405);
});

test("rejects wrong content type, malformed payloads, and caller-supplied ownership", async () => {
  const { repository } = fakeRepository();
  const wrongType = await handleIngestRequest(
    request(validPayload(), { contentType: "text/plain" }),
    dependencies(repository),
  );
  const withUserId = await handleIngestRequest(
    request({ ...validPayload(), user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
    dependencies(repository),
  );
  const malformed = await handleIngestRequest(request("{"), dependencies(repository));

  assert.equal(wrongType.status, 415);
  assert.equal(withUserId.status, 400);
  assert.equal(malformed.status, 400);
  assert.equal(repository.isDuplicate instanceof Function, true);
});

test("persists a validated unknown-or-review email and returns the worker contract", async () => {
  const { repository, calls } = fakeRepository();
  const response = await handleIngestRequest(request(validPayload()), dependencies(repository));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    success: true,
    status: "needs_review",
    gmail_message_id: "test-message-id",
  });
  assert.equal(calls.duplicate, 1);
  assert.equal(calls.courses, 1);
  assert.equal(calls.persist, 1);
});

test("returns duplicate without a second write", async () => {
  const { repository, calls } = fakeRepository({ isDuplicate: async () => true });
  const response = await handleIngestRequest(request(validPayload()), dependencies(repository));
  const body = await response.json();

  assert.equal(body.status, "duplicate");
  assert.equal(calls.courses, 0);
  assert.equal(calls.persist, 0);
});

test("turns repository failures into retryable responses and only logs a stage", async () => {
  const stages: string[] = [];
  const { repository } = fakeRepository({
    persistAtomically: async () => {
      throw new Error("must not be returned or logged");
    },
  });
  const response = await handleIngestRequest(request(validPayload()), dependencies(repository, (stage) => stages.push(stage)));
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.retryable, true);
  assert.equal(body.error, undefined);
  assert.deepEqual(stages, ["database_persist"]);
});

test("rejects oversized payloads before creating a repository", async () => {
  let created = false;
  const oversizeRequest = request({ body_text: "x".repeat(300 * 1024) });
  const response = await handleIngestRequest(oversizeRequest, {
    ...dependencies(fakeRepository().repository),
    getRepository: () => {
      created = true;
      return fakeRepository().repository;
    },
  });

  assert.equal(response.status, 413);
  assert.equal(created, false);
});
