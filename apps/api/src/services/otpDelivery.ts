import { consumeQuota } from "./usageLimits.js";
import { setOtpSender } from "./otp.js";
import { sendEmailOtp } from "./email.js";

const isProduction = process.env.NODE_ENV === "production";

export async function sendResendOtp(email: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) throw new Error("Resend email delivery is not configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Your Jarvis verification code",
        text: `Your Jarvis verification code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
      }),
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      // Resend returns a useful JSON error message (for example, testing-recipient
      // restrictions or an unverified sender). Preserve that explanation in local
      // server logs without ever including request headers or credentials.
      let detail = "";
      try {
        const payload: unknown = await response.json();
        if (payload && typeof payload === "object") {
          const record = payload as Record<string, unknown>;
          const candidate = typeof record.message === "string" ? record.message
            : typeof record.error === "string" ? record.error
            : typeof record.name === "string" ? record.name : "";
          detail = candidate.replace(/[\r\n\t]+/g, " ").slice(0, 300);
        }
      } catch {
        await response.body?.cancel().catch(() => undefined);
      }
      throw new Error(`Resend rejected email delivery with HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }
    await response.body?.cancel().catch(() => undefined);
  } finally {
    clearTimeout(timer);
  }
}

export type OtpDeliveryProvider = "resend" | "smtp" | "dev-log" | "none";

function resendConfigured() { return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim()); }
function smtpConfigured() { return Boolean(process.env.BOBAI_SMTP_HOST?.trim() && process.env.BOBAI_SMTP_FROM?.trim()); }

/**
 * Which provider sends login codes. BOBAI_EMAIL_PROVIDER ("resend" or "smtp") picks one explicitly; without it Resend
 * wins when configured, then SMTP, so existing deployments keep their current behaviour.
 */
export function otpDeliveryProvider(): OtpDeliveryProvider {
  const chosen = process.env.BOBAI_EMAIL_PROVIDER?.trim().toLowerCase();
  if (chosen === "smtp") return smtpConfigured() ? "smtp" : "none";
  if (chosen === "resend") return resendConfigured() ? "resend" : "none";
  if (resendConfigured()) return "resend";
  if (smtpConfigured()) return "smtp";
  if (!isProduction && process.env.BOBAI_DEV_LOG_OTP === "true") return "dev-log";
  return "none";
}

export function otpDeliveryConfigured() {
  const provider = otpDeliveryProvider();
  return provider === "resend" || provider === "smtp";
}

/** Wraps a real sender with the daily email limit (Gmail ~500/day, Resend free 100/day). */
function withEmailLimit(send: (email: string, code: string) => Promise<void>) {
  return async (email: string, code: string) => {
    const state = await consumeQuota("email");
    if (!state.allowed) throw Object.assign(new Error(`daily email limit of ${state.limit} reached`), { publicMessage: "Jarvis has sent all the sign-in emails it can for today. Please try again tomorrow." });
    await send(email, code);
  };
}

export function configureOtpDelivery() {
  const provider = otpDeliveryProvider();
  if (provider === "resend") {
    // Without a verified domain Resend only delivers to the account owner. If SMTP is also configured, a refused
    // Resend send is retried over SMTP instead of failing the login (never logs the code or the address).
    setOtpSender(withEmailLimit(async (email, code) => {
      try { await sendResendOtp(email, code); }
      catch (error) {
        if (!smtpConfigured() || process.env.BOBAI_EMAIL_PROVIDER?.trim().toLowerCase() === "resend") throw error;
        console.warn(JSON.stringify({ event: "otp_resend_failed_trying_smtp", error: error instanceof Error ? error.message.slice(0, 200) : "unknown" }));
        await sendEmailOtp(email, code);
      }
    }));
    return;
  }
  if (provider === "smtp") { setOtpSender(withEmailLimit(sendEmailOtp)); return; }
  if (provider === "dev-log") {
    setOtpSender(async (email, code) => { console.log(`[OTP development only] ${email}: ${code}`); });
    return;
  }
  setOtpSender(async () => { throw new Error("Email delivery is not configured. Set SMTP (BOBAI_SMTP_*) or Resend credentials; for local development only, BOBAI_DEV_LOG_OTP=true."); });
}
