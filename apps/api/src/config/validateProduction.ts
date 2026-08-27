export function validateProductionConfig() {
  if (process.env.NODE_ENV !== "production") return;

  const required = ["DATABASE_URL", "CORS_ORIGIN", "BOBAI_AGENT_KEY"];
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) throw new Error(`Missing production configuration: ${missing.join(", ")}`);
  if (process.env.BOBAI_AGENT_KEY!.length < 32) throw new Error("BOBAI_AGENT_KEY must be at least 32 characters in production");
  if (process.env.CORS_ORIGIN!.split(",").some((origin) => !/^https:\/\/[^\s,*]+$/i.test(origin.trim()))) {
    throw new Error("CORS_ORIGIN must contain only explicit HTTPS origins in production");
  }
  if (process.env.TRUST_PROXY === "true") {
    const hops = Number(process.env.TRUST_PROXY_HOPS);
    if (!Number.isInteger(hops) || hops < 1 || hops > 10) throw new Error("TRUST_PROXY_HOPS must be an integer from 1 to 10");
  }
  const admins = (process.env.BOBAI_ADMIN_EMAILS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  if (admins.length !== 2 || new Set(admins).size !== 2 || admins.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error("BOBAI_ADMIN_EMAILS must contain exactly two distinct valid email addresses in production");
  }
  if (process.env.BOBAI_CODING_AGENT_URL && (!process.env.BOBAI_CODING_AGENT_KEY || process.env.BOBAI_CODING_AGENT_KEY.length < 32)) {
    throw new Error("BOBAI_CODING_AGENT_KEY must be at least 32 characters when the coding-agent bridge is enabled");
  }
}
