export function validateProductionConfig() {
  if (process.env.NODE_ENV !== "production") return;
  if ((process.env.BOBAI_MODEL_PROVIDER || "ollama").trim().toLowerCase() === "openrouter" && !process.env.OPENROUTER_API_KEY?.trim()) throw new Error("OPENROUTER_API_KEY is required when BOBAI_MODEL_PROVIDER=openrouter");
  const required = ["DATABASE_URL","CORS_ORIGIN","BOBAI_AGENT_KEY","BOBAI_WEB_URL","BOBAI_AUTH_REDIRECT_BASE_URL","BOBAI_MFA_ENCRYPTION_KEY"];
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) throw new Error(`Missing production configuration: ${missing.join(", ")}`);
  const hasResend = Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim());
  const hasSmtp = Boolean(process.env.BOBAI_SMTP_HOST?.trim() && process.env.BOBAI_SMTP_FROM?.trim());
  if (!hasResend && !hasSmtp) throw new Error("Configure Resend (RESEND_API_KEY and RESEND_FROM_EMAIL) or SMTP before production launch");
  if (Boolean(process.env.RESEND_API_KEY?.trim()) !== Boolean(process.env.RESEND_FROM_EMAIL?.trim())) throw new Error("RESEND_API_KEY and RESEND_FROM_EMAIL must be provided together");
  const mfaKey = process.env.BOBAI_MFA_ENCRYPTION_KEY!.trim();
  const mfaKeyBytes = /^[0-9a-f]{64}$/i.test(mfaKey) ? Buffer.from(mfaKey, "hex").length : Buffer.from(mfaKey, "base64").length;
  if (mfaKeyBytes !== 32) throw new Error("BOBAI_MFA_ENCRYPTION_KEY must decode to exactly 32 bytes in production");
  if (process.env.BOBAI_AGENT_KEY!.length < 32) throw new Error("BOBAI_AGENT_KEY must be at least 32 characters in production");
  for (const [key, value] of [["BOBAI_WEB_URL", process.env.BOBAI_WEB_URL!],["BOBAI_AUTH_REDIRECT_BASE_URL", process.env.BOBAI_AUTH_REDIRECT_BASE_URL!]] as const) {
    try { const url = new URL(value); if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error(); }
    catch { throw new Error(`${key} must be a valid HTTPS URL without credentials, query, or fragment in production`); }
  }
  if (process.env.BOBAI_AUTH_REDIRECT_BASE_URL!.endsWith("/")) throw new Error("BOBAI_AUTH_REDIRECT_BASE_URL must not end with / in production");
  if (process.env.CORS_ORIGIN!.split(",").some((origin) => !/^https:\/\/[^\s,*]+$/i.test(origin.trim()))) throw new Error("CORS_ORIGIN must contain only explicit HTTPS origins in production");
  if (process.env.TRUST_PROXY === "true") { const hops = Number(process.env.TRUST_PROXY_HOPS); if (!Number.isInteger(hops) || hops < 1 || hops > 10) throw new Error("TRUST_PROXY_HOPS must be an integer from 1 to 10"); }
  for (const key of ["BOBAI_UPLOAD_IMAGE_RETENTION_DAYS", "BOBAI_UPLOAD_DOCUMENT_RETENTION_DAYS"]) {
    const raw = process.env[key];
    if (raw !== undefined && (!/^\d+$/.test(raw) || Number(raw) > 3650)) throw new Error(`${key} must be an integer from 0 to 3650 (0 disables automatic deletion)`);
  }
  if (process.env.BOBAI_CODING_AGENT_URL && (!process.env.BOBAI_CODING_AGENT_KEY || process.env.BOBAI_CODING_AGENT_KEY.length < 32)) throw new Error("BOBAI_CODING_AGENT_KEY must be at least 32 characters when the coding-agent bridge is enabled");
  if (process.env.BOBAI_CODING_AGENT_URL && process.env.BOBAI_CODING_AGENT_SANDBOX_ATTESTED !== "true") throw new Error("BOBAI_CODING_AGENT_SANDBOX_ATTESTED must be true before the coding-agent bridge can run in production");
}
