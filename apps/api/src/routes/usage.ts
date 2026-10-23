import { Router } from "express";
import { peekQuota } from "../services/usageLimits.js";

const router = Router();

/** Today's message count for the signed-in user, and the site-wide count, for the Settings page. */
router.get("/", async (req, res) => {
  const [mine, site] = await Promise.all([peekQuota("chat_user", req.user!.id), peekQuota("chat_site")]);
  return res.json({ messages: { used: mine.used, limit: mine.limit, resetsAt: mine.resetsAt }, site: { used: site.used, limit: site.limit } });
});

export default router;
