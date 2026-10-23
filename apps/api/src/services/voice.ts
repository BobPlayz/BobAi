import { piperStatus, synthesizeLocal } from "./bobVoice.js";
import { elevenLabsConfigured, elevenLabsSynthesize, elevenLabsTranscribe, speakableText, wavSeconds } from "./elevenlabs.js";
import { consumeQuota } from "./usageLimits.js";
import { transcribeLocal, whisperStatus } from "./whisperCpp.js";

/** Speech to text: ElevenLabs Scribe wherever ElevenLabs is the voice provider, Whisper.cpp on a PC. */
export const transcribe = async (input: Buffer, options?: Record<string, unknown>) => {
  if (speechProvider() === "local") return transcribeLocal(input, options);
  const seconds = wavSeconds(input);
  if (seconds === null) throw new Error("invalid audio");
  if (seconds > 120) throw Object.assign(new Error("recording too long"), { publicMessage: "That recording is too long. Keep it under 2 minutes." });
  const quota = await consumeQuota("stt_seconds", "site", new Date(), Math.max(1, Math.ceil(seconds)));
  if (!quota.allowed) throw Object.assign(new Error("monthly speech input limit reached"), { publicMessage: "Jarvis has used this month's free voice-typing allowance. It's back next month." });
  return elevenLabsTranscribe(input, typeof options?.language === "string" ? options.language : undefined);
};
/** ElevenLabs on the hosted site (or when BOBAI_TTS_PROVIDER=elevenlabs) once a key is set; Whisper.cpp and Piper on a PC. */
export function speechProvider(): "elevenlabs" | "local" {
  const chosen = process.env.BOBAI_TTS_PROVIDER?.trim().toLowerCase();
  if (chosen === "local") return "local";
  if (!elevenLabsConfigured()) return "local";
  return chosen === "elevenlabs" || process.env.VERCEL === "1" ? "elevenlabs" : "local";
}
export const synthesize = async (text: string, options?: Record<string, unknown>) => {
  if (speechProvider() === "local") return synthesizeLocal(text, options);
  const quota = await consumeQuota("tts_chars", "site", new Date(), speakableText(text).length);
  if (!quota.allowed) throw Object.assign(new Error("monthly speech limit reached"), { publicMessage: "Jarvis has used this month's free voice allowance. Voice is back next month." });
  return elevenLabsSynthesize(text);
};
export const status = async () => {
  const local = { speechRecognition: await whisperStatus(), speechSynthesis: await piperStatus() };
  const cloud = speechProvider() === "elevenlabs";
  return {
  // What the browser needs to know: can the server hear and speak? If not, talk mode uses the browser's own voice.
  available: { speechToText: cloud || Boolean(local.speechRecognition.ready), textToSpeech: cloud || Boolean(local.speechSynthesis.ready) },
  local,
  externalProviderConfigured: elevenLabsConfigured(),
  speechProvider: speechProvider(),
  voiceProfile: {
    engine: "Piper",
    english: "en_GB-alan-medium",
    telugu: "te_IN-venkatesh-medium",
    offline: true,
  },
  };
};
