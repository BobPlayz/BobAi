import express, { type Express } from "express";

/**
 * Vercel entrypoint. Loads the real app lazily so that a crash while loading (a bad environment value, a module
 * that cannot initialise) becomes a readable 503 instead of FUNCTION_INVOCATION_FAILED on every route.
 * The public response carries only a redacted one-line reason; the full error goes to the deployment logs.
 */
const SECRET_PATTERNS: RegExp[] = [
  /[a-z][a-z0-9+.-]*:\/\/[^\s/@]+@/gi, // credentials inside URLs (postgres://user:pass@host)
  /\b(?:re|sk|pk|rk|npg|ghp|github_pat)_[A-Za-z0-9_]{6,}/g, // provider key formats
  /\b[A-Za-z0-9+/_-]{32,}={0,2}/g, // long tokens / base64 blobs
  /[^\s@]+@[^\s@]+\.[a-z]{2,}/gi, // email addresses
];

export function describeStartupError(error: unknown) {
  const name = error instanceof Error ? error.name : "Error";
  const code = error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : undefined;
  let message = error instanceof Error ? error.message.split("\n")[0] : String(error);
  for (const pattern of SECRET_PATTERNS) message = message.replace(pattern, "[redacted]");
  return { name, ...(code ? { code } : {}), message: message.slice(0, 240) };
}

const loaded: Promise<Express | { startupError: unknown }> = import("./app.js")
  .then((module) => module.default)
  .catch((startupError: unknown) => {
    console.error("Jarvis API failed to start", startupError);
    return { startupError };
  });

const entry = express();
entry.disable("x-powered-by");
entry.use(async (req, res, next) => {
  const app = await loaded;
  if ("startupError" in app) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({ status: "startup_failed", error: describeStartupError(app.startupError) });
  }
  return app(req, res, next);
});

export default entry;
