import { Router } from "express";

export const chatRouter = Router();

chatRouter.post("/chat", (req, res) => {
  const { message } = req.body ?? {};

  res.json({
    reply: message
      ? `BobAI received: ${message}`
      : "BobAI is online and ready.",
    conversationId: null,
    model: "bobai-dev"
  });
});