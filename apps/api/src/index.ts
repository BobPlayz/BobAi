import "dotenv/config";
import { app } from "./app.js";
import { configureOtpDelivery } from "./services/otpDelivery.js";

const PORT = Number(process.env.PORT || 3001);

configureOtpDelivery();

app.listen(PORT, () => {
  console.log(`BobAI API listening on http://localhost:${PORT}`);
});
