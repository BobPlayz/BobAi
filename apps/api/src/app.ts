import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { apiRouter } from "./routes/index.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { securityLog } from "./middleware/securityLog.js";
import { validateRequestBody } from "./middleware/requestValidation.js";
import { validateProductionConfig } from "./config/validateProduction.js";
import { startMaintenance } from "./services/maintenance.js";
import { executionResultLimit } from "./middleware/executionResultLimit.js";
import { configureOtpDelivery } from "./services/otpDelivery.js";
// A configuration error used to throw at import time, which made every request (even /health) fail with an
// opaque FUNCTION_INVOCATION_FAILED on Vercel. Keep the process up and answer 503 with the reason instead.
let configurationError: string | null = null;
try { validateProductionConfig(); } catch (error) { configurationError = error instanceof Error ? error.message : "invalid production configuration"; console.error(JSON.stringify({ event: "configuration_error", error: configurationError })); }
configureOtpDelivery();
export const app = express();
const isProduction = process.env.NODE_ENV === "production"; const allowedOrigins = (process.env.CORS_ORIGIN || "*").split(",").map((origin) => origin.trim()).filter(Boolean);
if (isProduction && (!allowedOrigins.length || allowedOrigins.includes("*"))) configurationError ??= "CORS_ORIGIN must explicitly list allowed origins in production";
app.disable("x-powered-by"); const trustProxy = process.env.TRUST_PROXY === "true"; const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 1); app.set("trust proxy", trustProxy ? trustProxyHops : false);
app.use(cors({ origin: allowedOrigins.length === 1 && allowedOrigins[0] === "*" ? true : allowedOrigins, credentials: true, methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id", "X-BobAI-Agent-Key", "X-CSRF-Protection", "Idempotency-Key"] }));
app.use((req, res, next) => { const headerBytes = req.rawHeaders.reduce((total, value) => total + Buffer.byteLength(value, "utf8"), 0); if (headerBytes > 16 * 1024) return res.status(431).json({ error: "request headers too large" }); return next(); });
app.use((req, res, next) => { res.setHeader("Cache-Control", "no-store"); res.setHeader("Pragma", "no-cache"); res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("X-Frame-Options", "DENY"); res.setHeader("Referrer-Policy", "no-referrer"); res.setHeader("Permissions-Policy", "camera=(), microphone=(self), geolocation=()"); res.setHeader("Cross-Origin-Resource-Policy", "same-site"); res.setHeader("X-Permitted-Cross-Domain-Policies", "none"); res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"); if (isProduction) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains"); next(); });
app.use((req, res, next) => { const startedAt = process.hrtime.bigint(); res.on("finish", () => { const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000; if (res.statusCode >= 500) console.error(JSON.stringify({ event: "http_request", requestId: res.getHeader("x-request-id"), method: req.method, path: req.path, status: res.statusCode, durationMs: Math.round(durationMs) })); }); const incoming = req.header("x-request-id"); const requestId = incoming && /^[A-Za-z0-9._:-]{1,128}$/.test(incoming) ? incoming : randomUUID(); res.setHeader("x-request-id", requestId); next(); });
// The specific reason stays in the server log; callers only learn that the deployment is misconfigured.
app.use((_req, res, next) => configurationError ? res.status(503).json({ status: "misconfigured", error: "server configuration is incomplete; check the deployment logs" }) : next());
app.use(securityLog); app.use(rateLimit); app.use("/images/generate", express.json({ limit: process.env.IMAGE_JSON_BODY_LIMIT || "12mb", strict: true, type: ["application/json", "application/*+json"] })); app.use("/vision/analyze", express.json({ limit: process.env.VISION_JSON_BODY_LIMIT || "17mb", strict: true, type: ["application/json", "application/*+json"] })); app.use(["/stream", "/chat"], express.json({ limit: process.env.CHAT_JSON_BODY_LIMIT || "5mb", strict: true, type: ["application/json", "application/*+json"] })); app.use(["/voice/transcribe", "/voice/turn"], express.json({ limit: process.env.VOICE_JSON_BODY_LIMIT || "34mb", strict: true, type: ["application/json", "application/*+json"] })); app.use("/ffmpeg", express.json({ limit: process.env.MEDIA_JSON_BODY_LIMIT || "44mb", strict: true, type: ["application/json", "application/*+json"] })); app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "2mb", strict: true, type: ["application/json", "application/*+json"] })); app.use(express.urlencoded({ extended: false, limit: "256kb", parameterLimit: 100 })); app.use(validateRequestBody); app.use(executionResultLimit); if (process.env.VERCEL !== "1" && process.env.BOBAI_DISABLE_BACKGROUND_WORKERS !== "true") startMaintenance();
app.use((req, res, next) => { if (!isProduction || !["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next(); const hasSessionCookie = /(?:^|;)\s*jarvis_(?:access|refresh)=/.test(req.header("cookie") || ""); if (!hasSessionCookie) return next(); const origin = req.header("origin"); const csrfHeader = req.header("x-csrf-protection"); if (!origin || !allowedOrigins.includes(origin) || csrfHeader !== "1") return res.status(403).json({ error: "request origin validation failed" }); return next(); });
app.get("/", (_req, res) => res.json({ name: "Jarvis API", status: "ok" })); app.use(apiRouter); app.use((_req, res) => res.status(404).json({ error: "route not found" })); app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const type = error && typeof error === "object" ? (error as { type?: unknown }).type : undefined;
  if (!res.headersSent && type === "entity.too.large") return res.status(413).json({ error: "request body exceeds the route limit" });
  if (!res.headersSent && type === "entity.parse.failed") return res.status(400).json({ error: "invalid JSON request body" });
  console.error(JSON.stringify({ event: "api_error", requestId: res.getHeader("x-request-id"), error: error instanceof Error ? error.message : "unknown error" }));
  if (!res.headersSent) return res.status(500).json({ error: "internal server error" });
});

// Vercel's Express runtime requires the application as a default export.
export default app;
