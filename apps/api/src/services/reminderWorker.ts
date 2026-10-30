import { and, eq, isNull, lte } from "drizzle-orm";
import { db, notifications, reminders } from "@bobai/db";
const INTERVAL_MS = 30_000;
let running = false;

/** Return the first scheduled occurrence strictly after now, including missed intervals. */
export function nextOccurrence(date: Date, rule: string | null, now = new Date()) {
  if (!rule) return null;
  const normalized = rule.trim().toLowerCase();
  if (!["daily", "weekly", "monthly"].includes(normalized)) return null;
  const next = new Date(date);
  if (normalized === "daily" || normalized === "weekly") {
    const step = normalized === "daily" ? 1 : 7;
    if (next <= now) {
      const missed = Math.floor((now.getTime() - next.getTime()) / (step * 86_400_000)) + 1;
      next.setUTCDate(next.getUTCDate() + missed * step);
    }
    return next;
  }

  // Advance by calendar months and clamp dates such as January 31 to the
  // final day of the target month instead of overflowing into the next month.
  const anchorDay = next.getUTCDate();
  const anchorMonth = next.getUTCFullYear() * 12 + next.getUTCMonth();
  let monthsAhead = Math.max(1, (now.getUTCFullYear() * 12 + now.getUTCMonth()) - anchorMonth);
  for (;;) {
    const targetMonth = anchorMonth + monthsAhead;
    const year = Math.floor(targetMonth / 12);
    const month = targetMonth % 12;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const candidate = new Date(next);
    candidate.setUTCFullYear(year, month, Math.min(anchorDay, lastDay));
    if (candidate > now) return candidate;
    monthsAhead += 1;
  }
}

export async function runReminderSweep() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  if (running) return;
  running = true;
  try {
    const now = new Date();
    const due = await db.select().from(reminders).where(and(lte(reminders.remindAt, now), isNull(reminders.sentAt), isNull(reminders.deletedAt), eq(reminders.isCompleted, false))).limit(100);
    for (const reminder of due) {
      await db.transaction(async (tx) => {
        const [claimed] = await tx.update(reminders).set({ sentAt: now, updatedAt: now }).where(and(eq(reminders.id, reminder.id), isNull(reminders.sentAt), isNull(reminders.deletedAt), eq(reminders.isCompleted, false))).returning({ id: reminders.id });
        if (!claimed) return;
        await tx.insert(notifications).values({ workspaceId: reminder.workspaceId, userId: reminder.userId, type: "reminder", title: reminder.title, body: reminder.message, channel: "in_app", data: { reminderId: reminder.id, taskId: reminder.taskId } });
        const next = nextOccurrence(reminder.remindAt, reminder.recurrenceRule, now);
        if (next) await tx.update(reminders).set({ remindAt: next, sentAt: null, isCompleted: false, updatedAt: now }).where(eq(reminders.id, reminder.id));
        else await tx.update(reminders).set({ isCompleted: true, updatedAt: now }).where(eq(reminders.id, reminder.id));
      });
    }
  } finally { running = false; }
}
export function startReminderWorker() {
  const run = () => { void runReminderSweep().catch((error) => console.error("reminder worker sweep failed", error)); };
  run();
  const timer = setInterval(run, INTERVAL_MS);
  timer.unref();
  return timer;
}
