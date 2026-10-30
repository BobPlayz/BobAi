import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { runReminderSweep } from "../services/reminderWorker.js";

const router = Router();

router.get("/reminders", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const authorization = req.header("authorization") || "";
  const expected = secret ? `Bearer ${secret}` : "";
  const suppliedBytes = Buffer.from(authorization);
  const expectedBytes = Buffer.from(expected);
  if (!secret || suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    await runReminderSweep();
    return res.json({ ok: true });
  } catch (error) {
    console.error("scheduled reminder sweep failed", error);
    return res.status(500).json({ error: "reminder sweep failed" });
  }
});

export default router;
