import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { parseEmail } from "@/lib/email/parse";
import { normalizeEmail } from "@/lib/email/normalize";
import type { CourseDefinition } from "@/lib/email/types";

const fixture = (name: string) =>
  readFileSync(join(process.cwd(), "tests", "fixtures", name), "utf8");

function emailFixture(name: string) {
  const source = fixture(name).replace(/\r\n?/g, "\n");
  const separator = source.indexOf("\n\n");
  if (separator < 0)
    throw new Error(`Fixture ${name} is missing its subject/body separator.`);
  const subjectLine = source.slice(0, source.indexOf("\n"));
  return {
    subject: subjectLine.replace(/^Subject:\s*/, ""),
    body: source.slice(separator + 2),
  };
}

const demoCourse: CourseDefinition = {
  id: "course-demo",
  name: "Example Systems",
  course_code: "DEMO-101",
  aliases: ["Systems Seminar"],
};

test("classifies the redacted single assignment reminder and preserves its source date", () => {
  const { subject, body } = emailFixture("assignment-reminder.redacted.txt");
  const sampleDate = "Monday, 2 November 2026, 7:00 AM";
  const result = parseEmail(
    {
      subject: subject.replace("[REDACTED_WEEKDAY_DATE_TIME]", sampleDate),
      body: body.replaceAll("[REDACTED_WEEKDAY_DATE_TIME]", sampleDate),
    },
    { sourceTimeZone: "UTC" },
  );

  assert.equal(result.classification, "assignment");
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].title, "[REDACTED_TASK]");
  assert.equal(result.tasks[0].originalDueText, sampleDate);
  assert.equal(result.tasks[0].dueAt, "2026-11-02T07:00:00.000Z");
  assert.equal(result.tasks[0].needsReview, true);
  assert.ok(result.tasks[0].reviewReasons.includes("course_unmatched"));
});

test("parses a dated project notice as an assignment without inventing its missing time", () => {
  const { subject, body } = emailFixture("course-project-notice.redacted.txt");
  const result = parseEmail({
    subject,
    body: body.replace("[REDACTED_DATE]", "30 November 2037"),
  });

  assert.equal(result.classification, "assignment");
  assert.equal(result.tasks[0].dueAt, null);
  assert.equal(result.tasks[0].originalDueText, "30 November 2037");
  assert.ok(result.tasks[0].reviewReasons.includes("due_time_missing"));
});

test("expands a seven-day digest into separate dated tasks", () => {
  const { subject, body } = emailFixture("assignment-digest.redacted.txt");
  const result = parseEmail(
    {
      subject: subject.replace("[REDACTED_NUMBER]", "7"),
      body: body
        .replace("[REDACTED_DATE]", "Saturday, 31 October 2026")
        .replace("[REDACTED_TIME_1]", "11:00 PM")
        .replace("[REDACTED_TIME_2]", "7:00 AM")
        // Synthetic values keep the redacted fixture compatible with the parser's course-line format.
        .replaceAll("[REDACTED_COURSE_CODE]", "DEMO-101")
        .replaceAll("[REDACTED_COURSE_NAME]", "Example Systems"),
    },
    { sourceTimeZone: "UTC" },
  );

  assert.equal(result.classification, "assignment");
  assert.equal(result.tasks.length, 2);
  assert.equal(
    result.tasks[0].originalDueText,
    "Saturday, 31 October 2026, 11:00 PM",
  );
  assert.equal(result.tasks[0].dueAt, "2026-10-31T23:00:00.000Z");
  assert.equal(result.tasks[1].dueAt, "2026-10-31T07:00:00.000Z");
});

test("matches a configured course code/name/alias without creating a course", () => {
  const result = parseEmail(
    {
      subject: "Due on Monday, 2 November 2026, 7:00 AM: [REDACTED_TASK]",
      body: "The assignment [REDACTED_TASK] in course DEMO-101 - Example Systems is due soon. Due: Monday, 2 November 2026, 7:00 AM",
    },
    { courses: [demoCourse], sourceTimeZone: "UTC" },
  );

  assert.equal(result.tasks[0].courseId, "course-demo");
  assert.equal(result.tasks[0].needsReview, false);
});

test("classifies quiz, exam, and announcement keyword probes", () => {
  assert.equal(
    parseEmail({ subject: "Quiz: [REDACTED]", body: "" }).classification,
    "quiz",
  );
  assert.equal(
    parseEmail({ subject: "Exam: [REDACTED]", body: "" }).classification,
    "exam",
  );
  assert.equal(
    parseEmail({
      subject: "Announcement: [REDACTED]",
      body: "A course announcement.",
    }).classification,
    "announcement",
  );
});

test("routes unrecognized content to review", () => {
  const result = parseEmail({
    subject: "[REDACTED]",
    body: "An unfamiliar notification.",
  });
  assert.equal(result.classification, "unknown");
  assert.equal(result.confidence, "low");
  assert.ok(result.reviewReasons.includes("unknown_type"));
  assert.equal(result.tasks.length, 0);
});

test("leaves dates null when timezone is unknown, date is absent, or date text is ambiguous", () => {
  const noZone = parseEmail({
    subject: "Due on Monday, 2 November 2026, 7:00 AM: [REDACTED_TASK]",
    body: "The assignment is due Monday, 2 November 2026, 7:00 AM.",
  });
  assert.equal(noZone.tasks[0].dueAt, null);
  assert.ok(
    noZone.tasks[0].reviewReasons.includes("source_timezone_not_configured"),
  );

  const missing = parseEmail({
    subject: "Assignment: [REDACTED_TASK]",
    body: "Work posted.",
  });
  assert.equal(missing.tasks[0].dueAt, null);
  assert.ok(missing.tasks[0].reviewReasons.includes("due_date_missing"));

  const ambiguous = parseEmail({
    subject: "Due on Monday, 2 November 2026, 7:00 AM: [REDACTED_TASK]",
    body: "The assignment is due Monday, 9 November 2026, 7:00 AM.",
  });
  assert.equal(ambiguous.tasks[0].dueAt, null);
  assert.ok(ambiguous.tasks[0].reviewReasons.includes("due_date_ambiguous"));
  assert.match(ambiguous.tasks[0].originalDueText ?? "", /2 November 2026/);

  const daylightOverlap = parseEmail(
    {
      subject: "Due on Sunday, 1 November 2026, 1:30 AM: [REDACTED_TASK]",
      body: "The assignment is due Sunday, 1 November 2026, 1:30 AM.",
    },
    { sourceTimeZone: "America/New_York" },
  );
  assert.equal(daylightOverlap.tasks[0].dueAt, null);
  assert.ok(
    daylightOverlap.tasks[0].reviewReasons.includes(
      "due_time_ambiguous_in_timezone",
    ),
  );
});

test("normalizes HTML, decodes entities, preserves safe activity links, and drops active content", () => {
  const normalized = normalizeEmail({
    subject: "&lt;Assignment&gt;",
    body: '<p>Due soon &amp; safely.</p><a href="https://portal.example.edu/activity/1">Go to activity</a><script>alert(1)</script>',
  });

  assert.match(normalized.body, /Due soon & safely/);
  assert.equal(normalized.links[0].label, "Go to activity");
  assert.equal(
    normalized.links[0].url,
    "https://portal.example.edu/activity/1",
  );
  assert.doesNotMatch(normalized.body, /alert\(1\)/);
});
