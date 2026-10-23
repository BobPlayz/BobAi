import { productionConfigProblems } from "./validateProduction.js";

const LOCAL_URL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i;
const unusable = (value: string | undefined) => !value?.trim() || LOCAL_URL.test(value.trim());

/**
 * On a public Vercel deployment, values copied from .env.example (NODE_ENV=development, localhost URLs) can never be
 * right. Replace localhost or missing site URLs with this deployment's own production address, always allow the
 * deployment's own origins, and switch to production mode once the remaining configuration is valid, so security
 * protections (CSRF origin check, secure cookies, redacted errors) are on without taking the site down.
 * Returns the names of the variables it changed (never values).
 */
export function applyHostedDefaults(env: NodeJS.ProcessEnv = process.env): string[] {
  if (env.VERCEL !== "1" || (env.VERCEL_ENV !== "production" && env.VERCEL_ENV !== "preview")) return [];
  const productionHost = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (!productionHost) return [];
  const site = `https://${productionHost}`;
  const changed: string[] = [];
  if (unusable(env.BOBAI_WEB_URL)) { env.BOBAI_WEB_URL = site; changed.push("BOBAI_WEB_URL"); }
  // OAuth callbacks are API routes, which live under /api on Vercel.
  if (unusable(env.BOBAI_AUTH_REDIRECT_BASE_URL)) { env.BOBAI_AUTH_REDIRECT_BASE_URL = `${site}/api`; changed.push("BOBAI_AUTH_REDIRECT_BASE_URL"); }
  const configured = (env.CORS_ORIGIN || "").split(",").map((origin) => origin.trim().replace(/\/+$/, "")).filter((origin) => origin && origin !== "*" && !LOCAL_URL.test(origin));
  const own = [site, ...[env.VERCEL_URL, env.VERCEL_BRANCH_URL].filter((host): host is string => Boolean(host?.trim())).map((host) => `https://${host.trim()}`)];
  const origins = [...new Set([...configured, ...own])];
  if (origins.join(",") !== (env.CORS_ORIGIN || "")) { env.CORS_ORIGIN = origins.join(","); changed.push("CORS_ORIGIN"); }
  // Vercel's edge overwrites X-Forwarded-For with the real client address (it cannot be spoofed), so trust exactly one
  // hop. Without this every visitor shares the proxy's address, and per-IP limits would lock everyone out at once.
  if (env.TRUST_PROXY !== "true" || env.TRUST_PROXY_HOPS !== "1") { env.TRUST_PROXY = "true"; env.TRUST_PROXY_HOPS = "1"; changed.push("TRUST_PROXY"); }
  // A coding-agent bridge on this machine's loopback can never be reached from a serverless function.
  if (env.BOBAI_CODING_AGENT_URL?.trim() && LOCAL_URL.test(env.BOBAI_CODING_AGENT_URL.trim())) { delete env.BOBAI_CODING_AGENT_URL; changed.push("BOBAI_CODING_AGENT_URL"); }
  if (env.NODE_ENV !== "production" && productionConfigProblems().length === 0) { env.NODE_ENV = "production"; changed.push("NODE_ENV"); }
  return changed;
}
