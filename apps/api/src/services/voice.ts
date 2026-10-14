import { piperStatus, synthesizeLocal } from "./bobVoice.js";
import { transcribeLocal, whisperStatus } from "./whisperCpp.js";

export const transcribe = async (input: Buffer, options?: Record<string, unknown>) => transcribeLocal(input, options);
export const synthesize = async (text: string, options?: Record<string, unknown>) => synthesizeLocal(text, options);
export const status = async () => ({
  local: { speechRecognition: await whisperStatus(), speechSynthesis: await piperStatus() },
  externalProviderConfigured: false,
  voiceProfile: {
    engine: "Piper",
    english: "en_GB-alan-medium",
    telugu: "te_IN-venkatesh-medium",
    offline: true,
  },
});
