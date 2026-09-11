import { and, eq, isNull, lte } from "drizzle-orm";
import { db, notifications, reminders } from "@bobai/db";
const INTERVAL_MS = 30_000;
let running = false;
function nextOccurrence(date: Date, rule: string | null) { if (!rule) return null; const next = new Date(date); const normalized = rule.trim().toLowerCase(); if (normalized === "daily") next.setUTCDate(next.getUTCDate() + 1); else if (normalized === "weekly") next.setUTCDate(next.getUTCDate() + 7); else if (normalized === "monthly") next.setUTCMonth(next.getUTCMonth() + 1); else return null; return next; }
export async function runReminderSweep() {
  if (running || !process.env.DATABASE_URL) return;
  running = true;
  try {
    const now = new Date();
    const due = await db.select().from(reminders).where(and(lte(reminders.remindAt, now), isNull(reminders.sentAt), isNull(reminders.deletedAt), eq(reminders.isCompleted, false))).limit(100);
    for (const reminder of due) {
      await db.transaction(async (tx) => {
        const [claimed] = await tx.update(reminders).set({ sentAt: now, updatedAt: now }).where(and(eq(reminders.id, reminder.id), isNull(reminders.sentAt), isNull(reminders.deletedAt), eq(reminders.isCompleted, false))).returning({ id: reminders.id });
        if (!claimed) return;
        await tx.insert(notifications).values({ workspaceId: reminder.workspaceId, userId: reminder.userId, type: "reminder", title: reminder.title, body: reminder.message, channel: "in_app", data: { reminderId: reminder.id, taskId: reminder.taskId } });
        const next = nextOccurrence(reminder.remindAt, reminder.recurrenceRule);
        if (next) await tx.update(reminders).set({ remindAt: next, sentAt: null, isCompleted: false, updatedAt: now }).where(eq(reminders.id, reminder.id));
        else await tx.update(reminders).set({ isCompleted: true, updatedAt: now }).where(eq(reminders.id, reminder.id));
      });
    }
  } finally { running = false; }
}
export function startReminderWorker() { void runReminderSweep().catch(() => undefined); const timer = setInterval(() => { void runReminderSweep().catch(() => undefined); }, INTERVAL_MS); timer.unref(); return timer; }
