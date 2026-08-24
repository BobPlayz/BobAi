import { Router } from "express";
import {
  remember,
  recall,
  recallAll,
  clearMemory,
} from "../memory/memory.js";

const router = Router();

router.get("/", (_req, res) =>
  res.json({ memories: recallAll() })
);

router.post("/remember", (req, res) => {
  const { key, value } = req.body;

  if (!key || !value) {
    return res.status(400).json({
      error: "key and value required",
    });
  }

  remember(key, value);
  res.json({ success: true });
});

router.get("/:key", (req, res) =>
  res.json({ value: recall(req.params.key) })
);

router.delete("/", (_req, res) => {
  clearMemory();
  res.json({ success: true });
});

export default router;