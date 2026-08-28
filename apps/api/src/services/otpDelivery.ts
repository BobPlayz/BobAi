import { setOtpSender } from "./otp.js";
import { sendEmailOtp } from "./email.js";

const isProduction = process.env.NODE_ENV === "production";
const hasResend = Boolean(process.env.RESEND_API_KEY?.trim());

/**
 * OTP delivery stays behind the OtpSender interface so the provider can be
 * replaced later without changing OTP generation or verification.
 */
export function configureOtpDelivery() {
  if (hasResend) {
    setOtpSender(sendEmailOtp);
    return;
  }

  if (isProduction) {
    setOtpSender(async () => {
      throw new Error("OTP email delivery is not configured");
    });
    return;
  }

  setOtpSender(async (email, code) => {
    console.log(`[OTP] ${email}: ${code}`);
  });
}
