import { Router } from "express";

const router = Router();

// temporary in-memory conversation until DB is wired
const messages: { role: "user" | "assistant"; content: string }[] = [];

router.post("/chat", async (req, res) => {
  const { message } = req.body as { message?: string };

  if (!message) {
    return res.status(400).json({ error: "message required" });
  }

  messages.push({ role: "user", content: message });

  const reply = `bet. you said: "${message}"`;

  messages.push({ role: "assistant", content: reply });

  res.json({
    reply,
    messages,
  });
});

router.get("/conversations/local-dev", async (_req, res) => {
  res.json({
    id: "local-dev",
    title: "new chat",
    messages,
  });
});

export default router;