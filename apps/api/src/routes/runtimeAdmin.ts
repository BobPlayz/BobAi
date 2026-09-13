import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { modelRuntime } from "../services/modelRuntime.js";
import { inferTaskPlan } from "../services/modelRuntime.js";

const router = Router();
router.use(requireAdmin);

router.get("/runtime", (_req, res) => {
  res.json({ runtime: modelRuntime.snapshot(), resources: modelRuntime.resources() });
});

router.post("/runtime/plan", (req, res) => {
  const plan = inferTaskPlan({
    messages: req.body?.messages,
    hasImage: req.body?.hasImage === true,
    hasAudio: req.body?.hasAudio === true,
    wantsImage: req.body?.wantsImage === true,
    wantsSpeech: req.body?.wantsSpeech === true,
  });
  res.json(plan);
});

export default router;
