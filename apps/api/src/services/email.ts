import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY?.trim();
const from = process.env.RESEND_FROM?.trim() || "BobAI <onboarding@resend.dev>";
const resend = apiKey ? new Resend(apiKey) : null;

async function sendEmail(to: string, subject: string, text: string) {
  if (!resend) throw new Error("RESEND_API_KEY is not configured");
  const { error } = await resend.emails.send({ from, to: [to], subject, text });
  if (error) throw new Error(`email delivery failed: ${error.message}`);
}

export async function sendEmailOtp(email: string, code: string) {
  await sendEmail(email, "Your BobAI verification code", `Your BobAI verification code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`);
}

export async function sendPasswordResetEmail(email: string, rawToken: string) {
  const origin = process.env.BOBAI_WEB_URL?.trim() || process.env.CORS_ORIGIN?.split(",")[0]?.trim() || "http://localhost:3000";
  let resetUrl: URL;
  try { resetUrl = new URL("/reset-password", origin); } catch { throw new Error("BOBAI_WEB_URL or CORS_ORIGIN is invalid"); }
  resetUrl.searchParams.set("token", rawToken);
  await sendEmail(email, "Reset your BobAI password", `A password reset was requested for your BobAI account. Open this link within 15 minutes to choose a new password:\n\n${resetUrl.toString()}\n\nIf you did not request this, you can ignore this email.`);
}
