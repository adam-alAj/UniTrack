import type { EmailClassification } from "@/lib/email/types";

export type KeywordDictionary = Record<EmailClassification, RegExp[]>;

export const DEFAULT_KEYWORDS: KeywordDictionary = {
  assignment: [
    /\bassignments?\b/i,
    /\bhomework\b/i,
    /\bcourse project\b(?=[\s\S]{0,160}\b(?:deadline|due|submission)\b)/i,
    /\bdeadline for submission\b/i,
  ],
  quiz: [/\bquiz(?:zes)?\b/i, /\bpop quiz\b/i],
  exam: [/\bexams?\b/i, /\bmidterms?\b/i, /\bfinal exam\b/i],
  announcement: [/\bannouncements?\b/i],
  unknown: [],
};

export function classifyEmail(
  subject: string,
  body: string,
  keywords: KeywordDictionary = DEFAULT_KEYWORDS,
): { classification: EmailClassification; conflict: boolean } {
  const subjectMatches = (
    Object.keys(keywords) as EmailClassification[]
  ).filter(
    (category) =>
      category !== "unknown" &&
      keywords[category].some((pattern) => pattern.test(subject)),
  );
  const textMatches = (Object.keys(keywords) as EmailClassification[]).filter(
    (category) =>
      category !== "unknown" &&
      keywords[category].some((pattern) => pattern.test(body)),
  );

  const primary = subjectMatches.length > 0 ? subjectMatches : textMatches;
  if (primary.length === 1)
    return { classification: primary[0], conflict: false };
  if (primary.length > 1) return { classification: "unknown", conflict: true };

  // A dated course project notice is actionable even if the source says "project" rather than "assignment".
  if (
    /\bcourse project\b/i.test(`${subject}\n${body}`) &&
    /\b(?:deadline|due|submission)\b/i.test(body)
  ) {
    return { classification: "assignment", conflict: false };
  }

  // Observed eClass convention: assignment reminder subjects start "Due on …" or "Overdue: …".
  if (
    /^(?:due on\b|overdue:)/i.test(subject) &&
    /\b(?:due|assignment|overdue)\b/i.test(body)
  ) {
    return { classification: "assignment", conflict: false };
  }

  return { classification: "unknown", conflict: false };
}
