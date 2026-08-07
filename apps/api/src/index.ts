import express from "express";
import cors from "cors";

import chatRouter from "./routes/chat.js";
import imagesRouter from "./routes/images.js";
import conversationsRouter from "./routes/conversations.js";

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: "25mb" }));

app.get("/", (_req, res) => {
  res.json({
    name: "BobAI API",
    status: "ok",
    version: "1.0.0",
    features: {
      chat: true,
      images: true,
      conversations: true,
      streaming: true,
      memory: true,
      personality: true,
      vision: false,
      voice: false,
      browser: false,
      agents: false,
    },
  });
});

app.use("/chat", chatRouter);
app.use("/images", imagesRouter);
app.use("/conversations", conversationsRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);

  res.status(500).json({
    error: "internal server error",
  });
});

const PORT = Number(process.env.PORT || 3001);

app.listen(PORT, () => {
  console.log(`BobAI API listening on http://localhost:${PORT}`);
});