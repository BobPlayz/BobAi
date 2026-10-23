import { request } from "@/lib/api";

/**
 * Voice helpers. Jarvis's server can hear (ElevenLabs Scribe or Whisper.cpp) and speak (ElevenLabs or Piper) when
 * those are set up; otherwise talk mode falls back to the browser's own speech recognition and voice.
 */

export type VoiceAvailability = { speechToText: boolean; textToSpeech: boolean };

export async function getVoiceAvailability(): Promise<VoiceAvailability> {
  try {
    const res = await request("/voice/status");
    const data = await res.json().catch(() => ({}));
    return { speechToText: data?.available?.speechToText === true, textToSpeech: data?.available?.textToSpeech === true };
  } catch { return { speechToText: false, textToSpeech: false }; }
}

/** Converts a browser recording to the 16 kHz mono WAV the server expects. */
export async function toPcm16Wav(recording: Blob): Promise<Blob> {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) throw new Error("This browser cannot convert microphone audio for transcription.");
  const context = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData(await recording.arrayBuffer());
    const targetRate = 16_000;
    const outputLength = Math.ceil(decoded.length * targetRate / decoded.sampleRate);
    if (!outputLength || outputLength > targetRate * 180) throw new Error("Voice input must be 3 minutes or shorter.");
    const buffer = new ArrayBuffer(44 + outputLength * 2);
    const view = new DataView(buffer);
    const writeText = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
    writeText(0, "RIFF"); view.setUint32(4, 36 + outputLength * 2, true); writeText(8, "WAVE"); writeText(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, targetRate, true); view.setUint32(28, targetRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); writeText(36, "data"); view.setUint32(40, outputLength * 2, true);
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, channel) => decoded.getChannelData(channel));
    for (let i = 0; i < outputLength; i++) {
      const sourceStart = i * decoded.sampleRate / targetRate;
      const sourceIndex = Math.min(decoded.length - 1, Math.floor(sourceStart));
      const fraction = sourceStart - sourceIndex;
      let sample = 0;
      for (const channel of channels) sample += channel[sourceIndex] * (1 - fraction) + (channel[Math.min(sourceIndex + 1, decoded.length - 1)] ?? 0) * fraction;
      sample /= channels.length;
      const clipped = Math.max(-1, Math.min(1, sample));
      view.setInt16(44 + i * 2, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true);
    }
    return new Blob([buffer], { type: "audio/wav" });
  } finally { await context.close().catch(() => undefined); }
}

function toBase64(bytes: ArrayBuffer) {
  let binary = "";
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(binary);
}

export async function transcribeAudio(audio: Blob, language?: string) {
  const res = await request("/voice/transcribe", { method: "POST", body: JSON.stringify({ audio: toBase64(await audio.arrayBuffer()), ...(language ? { options: { language } } : {}) }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Voice transcription failed");
  const text = typeof data.text === "string" ? data.text : typeof data.transcript === "string" ? data.transcript : typeof data.data?.text === "string" ? data.data.text : "";
  if (!text.trim()) throw new Error("Didn't catch that. Try again?");
  return text.trim();
}

export async function synthesizeSpeech(text: string, options: Record<string, unknown> = {}) {
  const res = await request("/voice/synthesize", { method: "POST", body: JSON.stringify({ text, options }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Voice synthesis failed");
  const audio = typeof data.audio === "string" ? data.audio : typeof data.data?.audio === "string" ? data.data.audio : "";
  const mimeType = typeof data.mimeType === "string" ? data.mimeType : typeof data.data?.mimeType === "string" ? data.data.mimeType : "audio/wav";
  if (!audio) throw new Error("Voice provider returned no audio");
  return { audio, mimeType };
}

/** A playable object URL for base64 audio from the server. Revoke it when done. */
export function audioUrl(base64: string, mimeType: string) {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

/** Text worth saying out loud: code and markdown removed. */
export function speakable(text: string) {
  return text.replace(/```[\s\S]*?```/g, " (code's on screen) ").replace(/`([^`]+)`/g, "$1").replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#*_>~|]+/g, "").replace(/\s+/g, " ").trim().slice(0, 2_500);
}

const SPEECH_LOCALES: Record<string, string> = { en: "en-US", hi: "hi-IN", te: "te-IN", ta: "ta-IN", kn: "kn-IN", ml: "ml-IN", mr: "mr-IN", bn: "bn-IN", gu: "gu-IN", pa: "pa-IN", ur: "ur-PK", es: "es-ES", fr: "fr-FR", de: "de-DE", it: "it-IT", pt: "pt-BR", ar: "ar-SA", zh: "zh-CN", ja: "ja-JP", ko: "ko-KR", ru: "ru-RU", id: "id-ID", tr: "tr-TR", nl: "nl-NL" };
export function speechLocale(language: string) { return SPEECH_LOCALES[language] ?? "en-US"; }

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
export type BrowserRecognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};

/** The browser's built-in speech recognition (Chrome, Edge, Safari), or null. */
export function browserRecognition(): (new () => BrowserRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & { SpeechRecognition?: new () => BrowserRecognition; webkitSpeechRecognition?: new () => BrowserRecognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
