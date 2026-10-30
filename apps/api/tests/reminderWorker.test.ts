import test from "node:test";
import assert from "node:assert/strict";
import { nextOccurrence } from "../src/services/reminderWorker.js";

test("daily reminders skip missed occurrences and return a future date", () => {
  const start = new Date("2026-10-27T09:30:00.000Z");
  const now = new Date("2026-10-30T10:00:00.000Z");
  assert.equal(nextOccurrence(start, "daily", now)?.toISOString(), "2026-10-31T09:30:00.000Z");
});

test("weekly reminders advance past multiple missed weeks", () => {
  const start = new Date("2026-09-01T08:00:00.000Z");
  const now = new Date("2026-10-30T10:00:00.000Z");
  assert.equal(nextOccurrence(start, "weekly", now)?.toISOString(), "2026-11-03T08:00:00.000Z");
});

test("monthly reminders clamp month-end dates instead of overflowing", () => {
  const start = new Date("2026-01-31T08:00:00.000Z");
  const now = new Date("2026-03-01T00:00:00.000Z");
  assert.equal(nextOccurrence(start, "monthly", now)?.toISOString(), "2026-03-31T08:00:00.000Z");
});

test("unsupported or absent recurrence is one-time", () => {
  const start = new Date("2026-10-01T08:00:00.000Z");
  const now = new Date("2026-10-30T00:00:00.000Z");
  assert.equal(nextOccurrence(start, null, now), null);
  assert.equal(nextOccurrence(start, "yearly", now), null);
});
