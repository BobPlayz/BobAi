import express from "express";
import cors from "cors";

import chatRouter from "./routes/chat";
import imagesRouter from "./routes/images";
import memoryRouter from "./routes/memory";
import filesRouter from "./routes/files";

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
app.use("/images", imagesRouter);
app.use("/memory", memoryRouter);
app.use("/files", filesRouter);

const PORT = Number(process.env.PORT || 3001);

app.listen(PORT, () => {
  console.log(`BobAI API listening on http://localhost:${PORT}`);
});