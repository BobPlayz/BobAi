import { Router } from "express";
import {
  listConversations,
  getConversation,
  saveConversation,
  deleteConversation,
} from "../store/conversations.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    conversations: listConversations(),
  });
});

router.get("/:id", (req, res) => {
  const conversation = getConversation(req.params.id);

  if (!conversation) {
    return res.status(404).json({
      error: "conversation not found",
    });
  }

  return res.json(conversation);
});

router.post("/", (req, res) => {
  const conversation = req.body;

  saveConversation({
    ...conversation,
    updatedAt: Date.now(),
  });

  return res.json({
    success: true,
  });
});

router.delete("/:id", (req, res) => {
  deleteConversation(req.params.id);

  return res.json({
    success: true,
  });
});

export default router;