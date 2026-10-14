import { setOtpSender } from "./otp.js";
import { sendEmailOtp } from "./email.js";

const isProduction = process.env.NODE_ENV === "production";

async function sendResendOtp(email: string, code: string) {
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
        subject: "Your BobAI verification code",
        text: `Your BobAI verification code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
      }),
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error(`Resend rejected email delivery with HTTP ${response.status}`);
    }
    await response.body?.cancel().catch(() => undefined);
  } finally {
    clearTimeout(timer);
  }
}

export function configureOtpDelivery() {
  const hasResend = Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim());
  const hasSmtp = Boolean(process.env.BOBAI_SMTP_HOST?.trim() && process.env.BOBAI_SMTP_FROM?.trim());

  if (hasResend) {
    setOtpSender(sendResendOtp);
    return;
  }
  if (hasSmtp) {
    setOtpSender(sendEmailOtp);
    return;
  }
  if (isProduction) {
    setOtpSender(async () => { throw new Error("Email delivery is not configured; set Resend or SMTP credentials"); });
    return;
  }
  setOtpSender(async (email, code) => {
    if (process.env.BOBAI_DEV_LOG_OTP === "true") console.log(`[OTP development only] ${email}: ${code}`);
    else throw new Error("Email delivery is not configured. Set Resend or SMTP credentials, or explicitly enable BOBAI_DEV_LOG_OTP for local development.");
  });
}
