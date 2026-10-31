export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Month starts are supplied as local dates; the grid begins on Monday. */
export function buildMonthCells(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const dayCount = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const cellCount = Math.ceil((offset + dayCount) / 7) * 7;
  return Array.from(
    { length: cellCount },
    (_, index) =>
      new Date(month.getFullYear(), month.getMonth(), index - offset + 1),
  );
}
