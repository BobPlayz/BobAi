import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY?.trim();
const from = process.env.RESEND_FROM?.trim() || "BobAI <onboarding@resend.dev>";

const resend = apiKey ? new Resend(apiKey) : null;

export async function sendEmailOtp(email: string, code: string) {
  if (!resend) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const { error } = await resend.emails.send({
    from,
    to: [email],
    subject: "Your BobAI verification code",
    text: `Your BobAI verification code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
  });

  if (error) {
    throw new Error(`email delivery failed: ${error.message}`);
  }
}
