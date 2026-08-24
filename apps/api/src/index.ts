import express from "express";
import cors from "cors";

import chatRouter from "./routes/chat.js";
import imagesRouter from "./routes/images.js";
import memoryRouter from "./routes/memory.js";
import filesRouter from "./routes/files.js";
import agentsRouter from "./routes/agents.js";
import streamRouter from "./routes/stream.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/", (_req, res) => {
  res.json({
    name: "BobAI API",
    status: "ok",
  });
});

app.use("/chat", chatRouter);
app.use("/stream", streamRouter);
app.use("/images", imagesRouter);
app.use("/memory", memoryRouter);
app.use("/files", filesRouter);
app.use("/agents", agentsRouter);

const PORT = Number(process.env.PORT || 3001);

app.listen(PORT, () => {
  console.log(`BobAI API listening on http://localhost:${PORT}`);
});