"use client";

import { useEffect, useState } from "react";

export function LocalDateTime({ value, fallback = "Time unavailable" }: { value: string | null; fallback?: string }) {
  const [display, setDisplay] = useState(fallback);

  useEffect(() => {
    if (!value) {
      setDisplay(fallback);
      return;
    }
    setDisplay(new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)));
  }, [value, fallback]);

  return <time dateTime={value ?? undefined}>{display}</time>;
}
