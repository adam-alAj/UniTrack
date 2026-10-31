"use client";

import { useSyncExternalStore } from "react";

function subscribeToNothing() {
  return () => {};
}

export function LocalDateTime({
  value,
  fallback = "Time unavailable",
}: {
  value: string | null;
  fallback?: string;
}) {
  const display = useSyncExternalStore(
    subscribeToNothing,
    () =>
      value
        ? new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(value))
        : fallback,
    () => fallback,
  );

  return <time dateTime={value ?? undefined}>{display}</time>;
}
