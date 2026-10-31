import { classifyEmail, type KeywordDictionary } from "@/lib/email/classify";
import {
  combineDateAndTime,
  extractAssignmentLines,
  extractDescription,
  extractExplicitDueDateTexts,
  extractSubjectTitle,
  findPortalUrl,
  parseDueDateText,
  uniqueDueDateText,
} from "@/lib/email/extract";
import {
  matchCourse,
  extractCourseCandidate,
} from "@/lib/email/course-matcher";
import { normalizeEmail } from "@/lib/email/normalize";
import type {
  CourseDefinition,
  EmailInput,
  ParseResult,
  ParsedAnnouncement,
  ParsedTask,
  TaskClassification,
} from "@/lib/email/types";

export type ParseOptions = {
  courses?: CourseDefinition[];
  sourceTimeZone?: string;
  keywords?: KeywordDictionary;
};

function addReason(reasons: string[], reason: string) {
  if (!reasons.includes(reason)) reasons.push(reason);
}

function taskReasons(input: {
  title: string | null;
  courseId: string | null;
  dueReasons: string[];
  classificationConflict: boolean;
}): string[] {
  const reasons: string[] = [];
  if (!input.title) addReason(reasons, "title_missing");
  if (!input.courseId) addReason(reasons, "course_unmatched");
  for (const reason of input.dueReasons) addReason(reasons, reason);
  if (input.classificationConflict)
    addReason(reasons, "classification_conflict");
  return reasons;
}

function taskClassification(value: string): TaskClassification {
  return value as TaskClassification;
}

export function parseEmail(
  input: EmailInput,
  options: ParseOptions = {},
): ParseResult {
  const normalized = normalizeEmail(input);
  const courseList = options.courses ?? [];
  const combinedText = `${normalized.subject}\n${normalized.body}`;
  const classificationResult = classifyEmail(
    normalized.subject,
    normalized.body,
    options.keywords,
  );
  const classification = classificationResult.classification;
  const descriptions = extractDescription(normalized.body);
  const portalUrl = findPortalUrl(normalized.links, normalized.body);
  const dueTexts = extractExplicitDueDateTexts(
    normalized.subject,
    normalized.body,
  );
  const commonDueText = uniqueDueDateText(dueTexts);
  const subjectTitle = extractSubjectTitle(normalized.subject);
  const bodyTitle = normalized.body
    .match(/\bthe assignment\s+(.+?)\s+in\s+course\b/i)?.[1]
    ?.trim();
  const defaultTitle = subjectTitle ?? bodyTitle ?? null;
  const courseCandidate = extractCourseCandidate(combinedText);
  const matchedCourse = matchCourse(courseCandidate, combinedText, courseList);

  const rootReasons: string[] = [];
  if (classification === "unknown") addReason(rootReasons, "unknown_type");
  if (classificationResult.conflict)
    addReason(rootReasons, "classification_conflict");

  const tasks: ParsedTask[] = [];
  let announcement: ParsedAnnouncement | null = null;

  if (
    classification === "assignment" ||
    classification === "quiz" ||
    classification === "exam"
  ) {
    const bulletTasks = extractAssignmentLines(normalized.body);
    const isDigest = bulletTasks.length > 0;
    const candidates = isDigest
      ? bulletTasks.map((bullet) => ({
          title: bullet.title || null,
          courseCandidate: bullet.courseCandidate,
          dueText: combineDateAndTime(commonDueText, bullet.dueTimeText),
        }))
      : [
          {
            title: defaultTitle,
            courseCandidate,
            dueText: commonDueText,
          },
        ];

    for (const candidate of candidates) {
      const taskCourse = matchCourse(
        candidate.courseCandidate,
        combinedText,
        courseList,
      );
      const due =
        !candidate.dueText && dueTexts.length > 1
          ? {
              dueAt: null,
              originalDueText: dueTexts.join("; "),
              reviewReasons: ["due_date_ambiguous"],
            }
          : parseDueDateText(candidate.dueText, options.sourceTimeZone);
      const title = candidate.title?.trim() || null;
      const reasons = taskReasons({
        title,
        courseId: taskCourse?.id ?? null,
        dueReasons: due.reviewReasons,
        classificationConflict: classificationResult.conflict,
      });

      if (title) {
        tasks.push({
          title,
          type: taskClassification(classification),
          description: descriptions,
          courseId: taskCourse?.id ?? null,
          courseCandidate: candidate.courseCandidate,
          dueAt: due.dueAt,
          originalDueText: due.originalDueText,
          portalUrl,
          needsReview: reasons.length > 0,
          reviewReasons: reasons,
        });
      } else {
        for (const reason of reasons) addReason(rootReasons, reason);
      }
    }

    if (tasks.length === 0) addReason(rootReasons, "title_missing");
    for (const task of tasks) {
      for (const reason of task.reviewReasons) addReason(rootReasons, reason);
    }
  } else if (classification === "announcement") {
    const title = defaultTitle;
    if (!title) {
      addReason(rootReasons, "title_missing");
    } else {
      const reasons = matchedCourse ? [] : ["course_unmatched"];
      announcement = {
        title,
        content: descriptions,
        courseId: matchedCourse?.id ?? null,
        courseCandidate,
        sourceUrl: portalUrl,
        needsReview: reasons.length > 0,
        reviewReasons: reasons,
      };
      for (const reason of reasons) addReason(rootReasons, reason);
    }
  }

  const parsedDue = parseDueDateText(commonDueText, options.sourceTimeZone);
  const confidence =
    classification === "unknown"
      ? "low"
      : rootReasons.length > 0
        ? "medium"
        : "high";

  return {
    classification,
    confidence,
    reviewReasons: rootReasons,
    courseCandidate,
    title: tasks.length === 1 ? tasks[0].title : defaultTitle,
    description: descriptions,
    dueAt: tasks.length === 1 ? tasks[0].dueAt : parsedDue.dueAt,
    originalDueText:
      tasks.length === 1 ? tasks[0].originalDueText : parsedDue.originalDueText,
    portalUrl,
    tasks,
    announcement,
  };
}
