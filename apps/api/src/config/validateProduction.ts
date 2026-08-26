export function validateProductionConfig() {
  if (process.env.NODE_ENV !== "production") return;

  const required = ["DATABASE_URL", "CORS_ORIGIN", "BOBAI_AGENT_KEY"];
  const missing = required.filter((key) => !process.env[key]?.trim());

  if (missing.length) throw new Error(`Missing production configuration: ${missing.join(", ")}`);
  if (process.env.CORS_ORIGIN?.includes("*")) throw new Error("Wildcard CORS is forbidden in production");
  if (process.env.TRUST_PROXY === "true" && !process.env.TRUST_PROXY_HOPS) {
    throw new Error("TRUST_PROXY_HOPS is required when TRUST_PROXY is enabled");
  }
}
