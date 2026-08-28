import { setOtpSender } from "./otp.js";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Local development delivery. A real email provider can replace this sender
 * later without changing OTP generation or verification.
 */
export function configureOtpDelivery() {
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
