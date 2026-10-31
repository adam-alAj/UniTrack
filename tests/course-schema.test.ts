import assert from "node:assert/strict";
import test from "node:test";

import { CourseInputSchema } from "@/lib/courses/schema";

const course = { name: "Computer Systems", course_code: "CS-201", instructor: null, aliases: ["Systems"], color: "blue" };

test("course schema accepts configured names, codes, aliases, and colors", () => {
  assert.equal(CourseInputSchema.safeParse(course).success, true);
  assert.equal(CourseInputSchema.safeParse({ ...course, course_code: null, aliases: [], color: "violet" }).success, true);
});

test("course schema rejects blank names, duplicate aliases, and invalid colors", () => {
  assert.equal(CourseInputSchema.safeParse({ ...course, name: " " }).success, false);
  assert.equal(CourseInputSchema.safeParse({ ...course, aliases: ["Systems", "systems"] }).success, false);
  assert.equal(CourseInputSchema.safeParse({ ...course, color: "neon" }).success, false);
});
