import { setOtpSender } from "./otp.js";
import { sendEmailOtp } from "./email.js";

const isProduction = process.env.NODE_ENV === "production";
const hasSmtp = Boolean(process.env.BOBAI_SMTP_HOST?.trim() && process.env.BOBAI_SMTP_FROM?.trim());

export function configureOtpDelivery() {
  if (hasSmtp) {
    setOtpSender(sendEmailOtp);
    return;
  }

  if (isProduction) {
    setOtpSender(async () => {
      throw new Error("SMTP email delivery is not configured");
    });
    return;
  }

  setOtpSender(async (email, code) => {
    console.log(`[OTP] ${email}: ${code}`);
  });
}
