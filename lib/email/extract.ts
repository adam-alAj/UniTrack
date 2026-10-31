import type { EmailLink } from "@/lib/email/normalize";

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const DATE_PATTERN =
  "(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\\s*)?\\d{1,2}\\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{4}(?:,\\s*\\d{1,2}:\\d{2}\\s*(?:AM|PM))?";

export type DueDateResult = {
  dueAt: string | null;
  originalDueText: string | null;
  reviewReasons: string[];
};

export type AssignmentLine = {
  title: string;
  courseCandidate: string | null;
  dueTimeText: string | null;
};

export function extractExplicitDueDateTexts(...sources: string[]): string[] {
  const lead = new RegExp(
    `\\b(?:due(?:\\s+on)?|deadline(?:\\s+for\\s+submission)?(?:\\s+is)?|submission\\s+deadline(?:\\s+is)?)\\s*[:,]?\\s+(${DATE_PATTERN})`,
    "gi",
  );
  const results: string[] = [];

  for (const source of sources) {
    for (const match of source.matchAll(lead)) {
      const text = match[1].trim().replace(/[.;]+$/, "");
      if (
        !results.some(
          (value) =>
            value.toLocaleLowerCase("en") === text.toLocaleLowerCase("en"),
        )
      ) {
        results.push(text);
      }
    }
  }

  return results;
}

function parseDateParts(value: string) {
  const match = value.match(
    /^(?:(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*)?(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})(?:,\s*(\d{1,2}):(\d{2})\s*(AM|PM))?$/i,
  );
  if (!match) return null;

  const [
    ,
    weekday,
    dayText,
    monthText,
    yearText,
    hourText,
    minuteText,
    meridiem,
  ] = match;
  const year = Number(yearText);
  const month = MONTHS[monthText.toLowerCase()];
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    !Number.isInteger(year) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  let hour: number | null = null;
  let minute: number | null = null;
  if (hourText && minuteText && meridiem) {
    const hour12 = Number(hourText);
    minute = Number(minuteText);
    if (hour12 < 1 || hour12 > 12 || minute > 59) return null;
    hour = (hour12 % 12) + (meridiem.toUpperCase() === "PM" ? 12 : 0);
  }

  const expectedWeekday = weekday
    ? [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ][date.getUTCDay()]
    : null;

  return {
    year,
    month,
    day,
    hour,
    minute,
    expectedWeekday,
    actualWeekday: weekday,
  };
}

function localDateTimeToUtc(
  parts: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  },
  timeZone: string,
): { dueAt: string | null; ambiguous: boolean } {
  const target = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const localAsUtc = (instant: number) => {
    const fields = Object.fromEntries(
      formatter
        .formatToParts(new Date(instant))
        .map(({ type, value }) => [type, value]),
    );
    return Date.UTC(
      Number(fields.year),
      Number(fields.month) - 1,
      Number(fields.day),
      Number(fields.hour),
      Number(fields.minute),
      Number(fields.second),
    );
  };

  const offsets = new Set(
    [-36, -24, -12, 0, 12, 24, 36].map((hour) => {
      const instant = target + hour * 60 * 60 * 1000;
      return localAsUtc(instant) - instant;
    }),
  );
  const matches = [...offsets]
    .map((offset) => target - offset)
    .filter((instant) => localAsUtc(instant) === target);

  if (matches.length === 1)
    return { dueAt: new Date(matches[0]).toISOString(), ambiguous: false };
  return { dueAt: null, ambiguous: matches.length > 1 };
}

export function parseDueDateText(
  value: string | null,
  sourceTimeZone?: string,
): DueDateResult {
  if (!value)
    return {
      dueAt: null,
      originalDueText: null,
      reviewReasons: ["due_date_missing"],
    };

  const parts = parseDateParts(value);
  if (!parts) {
    return {
      dueAt: null,
      originalDueText: value,
      reviewReasons: ["due_date_unparseable"],
    };
  }

  if (parts.expectedWeekday && parts.expectedWeekday !== parts.actualWeekday) {
    return {
      dueAt: null,
      originalDueText: value,
      reviewReasons: ["due_date_weekday_mismatch"],
    };
  }

  if (parts.hour === null || parts.minute === null) {
    return {
      dueAt: null,
      originalDueText: value,
      reviewReasons: ["due_time_missing"],
    };
  }

  if (!sourceTimeZone) {
    return {
      dueAt: null,
      originalDueText: value,
      reviewReasons: ["source_timezone_not_configured"],
    };
  }

  try {
    const conversion = localDateTimeToUtc(
      {
        year: parts.year,
        month: parts.month,
        day: parts.day,
        hour: parts.hour,
        minute: parts.minute,
      },
      sourceTimeZone,
    );
    if (conversion.dueAt) {
      return {
        dueAt: conversion.dueAt,
        originalDueText: value,
        reviewReasons: [],
      };
    }
    return {
      dueAt: null,
      originalDueText: value,
      reviewReasons: [
        conversion.ambiguous
          ? "due_time_ambiguous_in_timezone"
          : "due_time_invalid_in_timezone",
      ],
    };
  } catch {
    return {
      dueAt: null,
      originalDueText: value,
      reviewReasons: ["source_timezone_invalid"],
    };
  }
}

export function extractSubjectTitle(subject: string): string | null {
  const duePrefix = subject.match(/^due on\s+.*?\b(?:AM|PM)\s*:\s*(.+)$/i);
  if (duePrefix?.[1]) return duePrefix[1].trim();

  const overduePrefix = subject.match(/^overdue:\s*(.+)$/i);
  if (overduePrefix?.[1]) return overduePrefix[1].trim();

  const typedPrefix = subject.match(
    /^(?:assignment|quiz|exam|announcement)\s*:\s*(.+)$/i,
  );
  if (typedPrefix?.[1]) return typedPrefix[1].trim();

  if (/^you have assignments due in\b/i.test(subject)) return null;
  return subject || null;
}

export function extractAssignmentLines(body: string): AssignmentLine[] {
  const lines = body.split("\n");
  const assignments: AssignmentLine[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(
      /^\s*[•*\-]\s*(.+?)\s+in\s+course\s+([A-Z0-9][A-Z0-9/_-]{1,30})\s*[-–—]\s*([^\n.!?]+?)\s*$/i,
    );
    if (!match) continue;

    const [, title, code, name] = match;
    const timeLine = lines
      .slice(index + 1, index + 3)
      .find((line) => /^\s*due\s*:/i.test(line));
    const timeMatch = timeLine?.match(/\b(\d{1,2}:\d{2}\s*(?:AM|PM))\b/i);
    assignments.push({
      title: title.trim(),
      courseCandidate:
        /^\[?redacted/i.test(code) || /^\[?redacted/i.test(name)
          ? null
          : `${code.trim()} - ${name.trim()}`,
      dueTimeText: timeMatch?.[1] ?? null,
    });
  }

  return assignments;
}

export function findPortalUrl(links: EmailLink[], body: string): string | null {
  const usable = links.filter((link) => {
    try {
      const url = new URL(link.url);
      return url.protocol === "https:" && url.hostname !== "mail.google.com";
    } catch {
      return false;
    }
  });

  const labeled = usable.find((link) =>
    /activity|assignment|quiz|exam|course|open|view/i.test(link.label),
  );
  if (labeled) return labeled.url;
  if (usable.length === 1) return usable[0].url;

  const plain = body.match(/https:\/\/[^\s<>"')\]]+/i)?.[0];
  if (!plain) return null;
  try {
    return new URL(plain).hostname === "mail.google.com"
      ? null
      : plain.replace(/[.,;:!?]+$/, "");
  } catch {
    return null;
  }
}

export function extractDescription(body: string): string | null {
  const text = body
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return (
        trimmed.length > 0 &&
        !/^(?:hi|hello|dear)\b/i.test(trimmed) &&
        !/^due\s*:/i.test(trimmed) &&
        !/^go to activity$/i.test(trimmed) &&
        !/^https?:\/\//i.test(trimmed) &&
        !/^[•*\-]\s*/.test(trimmed)
      );
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return text ? text.slice(0, 4000) : null;
}

export function combineDateAndTime(
  dateText: string | null,
  timeText: string | null,
): string | null {
  if (
    !dateText ||
    !timeText ||
    /,\s*\d{1,2}:\d{2}\s*(?:AM|PM)$/i.test(dateText)
  )
    return dateText;
  return `${dateText}, ${timeText}`;
}

export function uniqueDueDateText(values: string[]): string | null {
  const unique = [
    ...new Set(values.map((value) => value.toLocaleLowerCase("en"))),
  ];
  return unique.length === 1 ? values[0] : null;
}
