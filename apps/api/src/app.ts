import express from "express";
import cors from "cors";
import { apiRouter } from "./routes/index.js";

export const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/", (_req, res) => {
  res.json({
    name: "BobAI API",
    status: "ok",
  });
});

app.use(apiRouter);
