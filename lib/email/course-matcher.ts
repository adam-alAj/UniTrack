import type { CourseDefinition } from "@/lib/email/types";

export function normalizeCourseLabel(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

export function matchCourse(
  candidateText: string | null,
  fullText: string,
  courses: CourseDefinition[],
): CourseDefinition | null {
  const haystack = normalizeCourseLabel(
    [candidateText, fullText].filter(Boolean).join("\n"),
  );
  if (!haystack) return null;

  const scored = courses
    .map((course) => {
      const labels = [course.course_code ?? "", course.name, ...course.aliases]
        .map((value) => ({ value, normalized: normalizeCourseLabel(value) }))
        .filter(({ normalized }) => normalized.length >= 3);
      const exact = labels.find(
        ({ normalized }) => normalized && haystack.includes(normalized),
      );
      return { course, length: exact?.normalized.length ?? 0 };
    })
    .filter(({ length }) => length > 0)
    .sort((a, b) => b.length - a.length);

  if (scored.length === 0) return null;
  if (scored.length > 1 && scored[0].length === scored[1].length) return null;
  return scored[0].course;
}

export function extractCourseCandidate(text: string): string | null {
  const match = text.match(
    /\bcourse\s+([A-Z0-9][A-Z0-9/_-]{1,30})\s*[-–—]\s*([^\n.!?]{2,100})/i,
  );
  if (!match) return null;

  const code = match[1].trim();
  const name = match[2].trim();
  if (/^\[?redacted/i.test(code) || /^\[?redacted/i.test(name)) return null;
  return `${code} - ${name}`;
}
