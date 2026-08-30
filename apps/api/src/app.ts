import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { apiRouter } from "./routes/index.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { securityLog } from "./middleware/securityLog.js";
import { validateRequestBody } from "./middleware/requestValidation.js";
import { validateProductionConfig } from "./config/validateProduction.js";

validateProductionConfig();
export const app = express();
const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = (process.env.CORS_ORIGIN || "*").split(",").map((origin) => origin.trim()).filter(Boolean);

if (isProduction && (!allowedOrigins.length || allowedOrigins.includes("*"))) throw new Error("CORS_ORIGIN must explicitly list allowed origins in production");

app.disable("x-powered-by");
const trustProxy = process.env.TRUST_PROXY === "true";
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 1);
app.set("trust proxy", trustProxy ? trustProxyHops : false);
app.use(cors({ origin: allowedOrigins.length === 1 && allowedOrigins[0] === "*" ? true : allowedOrigins, methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id", "X-BobAI-Agent-Key"] }));
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (isProduction) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});
app.use((req, res, next) => {
  const incoming = req.header("x-request-id");
  const requestId = incoming && /^[A-Za-z0-9._:-]{1,128}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader("x-request-id", requestId);
  next();
});
app.use(securityLog);
app.use(rateLimit);
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "2mb" }));
app.use(validateRequestBody);
app.get("/", (_req, res) => res.json({ name: "BobAI API", status: "ok" }));
app.use(apiRouter);
app.use((_req, res) => res.status(404).json({ error: "route not found" }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (process.env.NODE_ENV !== "production") console.error("API ERROR:", error);
  if (!res.headersSent) return res.status(500).json({ error: "internal server error" });
});
