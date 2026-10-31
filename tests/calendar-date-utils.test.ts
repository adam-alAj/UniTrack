import assert from "node:assert/strict";
import test from "node:test";

import { buildMonthCells, localDateKey } from "@/lib/calendar/date-utils";

test("calendar month grid starts on Monday and contains all month dates", () => {
  const cells = buildMonthCells(new Date(2026, 1, 1));
  assert.equal(cells[0].getDay(), 1);
  assert.ok(cells.length === 28 || cells.length === 35 || cells.length === 42);
  assert.equal(cells.filter((cell) => cell.getMonth() === 1).length, 28);
  assert.equal(
    localDateKey(
      cells.find((cell) => cell.getMonth() === 1 && cell.getDate() === 1)!,
    ),
    "2026-02-01",
  );
});

test("calendar month grid includes six weeks when the month spans six rows", () => {
  const cells = buildMonthCells(new Date(2026, 7, 1));
  assert.equal(cells.length, 42);
  assert.deepEqual(
    cells.slice(0, 7).map((date) => date.getDate()),
    [27, 28, 29, 30, 31, 1, 2],
  );
});
