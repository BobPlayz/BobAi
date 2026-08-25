import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { apiRouter } from "./routes/index.js";
import { rateLimit } from "./middleware/rateLimit.js";

export const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || "*").split(",").map((origin) => origin.trim()).filter(Boolean);

app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "true");
app.use(cors({ origin: allowedOrigins.length === 1 && allowedOrigins[0] === "*" ? true : allowedOrigins }));
app.use((req, res, next) => {
  const incoming = req.header("x-request-id");
  const requestId = incoming && incoming.length <= 128 ? incoming : randomUUID();
  res.setHeader("x-request-id", requestId);
  next();
});
app.use(rateLimit);
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "10mb" }));

app.get("/", (_req, res) => res.json({ name: "BobAI API", status: "ok" }));
app.use(apiRouter);
app.use((_req, res) => res.status(404).json({ error: "route not found" }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("API ERROR:", error);
  if (res.headersSent) return;
  return res.status(500).json({ error: error instanceof Error ? error.message : "internal server error" });
});
