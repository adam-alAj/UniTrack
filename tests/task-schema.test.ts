import assert from "node:assert/strict";
import test from "node:test";

import { TaskInputSchema, TaskUpdateSchema } from "@/lib/tasks/schema";

const validTask = {
  title: "Study for the midterm",
  description: null,
  course_id: null,
  type: "exam",
  status: "not_started",
  due_at: null,
};

test("task validation accepts a valid task without a deadline", () => {
  const result = TaskInputSchema.safeParse(validTask);
  assert.equal(result.success, true);
});

test("task validation permits only supported types and statuses", () => {
  assert.equal(TaskInputSchema.safeParse({ ...validTask, status: "in_progress" }).success, true);
  assert.equal(TaskInputSchema.safeParse({ ...validTask, status: "done" }).success, false);
  assert.equal(TaskInputSchema.safeParse({ ...validTask, type: "lab" }).success, false);
});

test("task update requires a UUID and rejects unexpected ownership fields", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  assert.equal(TaskUpdateSchema.safeParse({ ...validTask, id }).success, true);
  assert.equal(TaskUpdateSchema.safeParse({ ...validTask, id: "task-1" }).success, false);
  assert.equal(TaskUpdateSchema.safeParse({ ...validTask, id, user_id: id }).success, false);
});
