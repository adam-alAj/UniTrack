export type EmailClassification =
  "assignment" | "quiz" | "exam" | "announcement" | "unknown";

export type TaskClassification = Extract<
  EmailClassification,
  "assignment" | "quiz" | "exam"
>;

export type CourseDefinition = {
  id: string;
  name: string;
  course_code: string | null;
  aliases: string[];
};

export type EmailInput = {
  subject: string;
  body: string;
};

export type ParsedTask = {
  title: string;
  type: TaskClassification;
  description: string | null;
  courseId: string | null;
  courseCandidate: string | null;
  dueAt: string | null;
  originalDueText: string | null;
  portalUrl: string | null;
  needsReview: boolean;
  reviewReasons: string[];
};

export type ParsedAnnouncement = {
  title: string;
  content: string | null;
  courseId: string | null;
  courseCandidate: string | null;
  sourceUrl: string | null;
  needsReview: boolean;
  reviewReasons: string[];
};

export type ParseResult = {
  classification: EmailClassification;
  confidence: "high" | "medium" | "low";
  reviewReasons: string[];
  courseCandidate: string | null;
  title: string | null;
  description: string | null;
  dueAt: string | null;
  originalDueText: string | null;
  portalUrl: string | null;
  tasks: ParsedTask[];
  announcement: ParsedAnnouncement | null;
};
