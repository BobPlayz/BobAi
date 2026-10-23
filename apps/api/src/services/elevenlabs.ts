/**
 * Speech to text (Scribe) and text to speech through ElevenLabs, used on the hosted site where Piper cannot run. Off unless ELEVENLABS_API_KEY is
 * set; the key stays on the server. Defaults: the British "George" voice and the low-cost Flash v2.5 model (about half
 * a credit per character, so the free plan's 10,000 monthly credits cover roughly 20,000 characters).
 */
const API = "https://api.elevenlabs.io/v1/text-to-speech/";
const STT_API = "https://api.elevenlabs.io/v1/speech-to-text";
const MAX_TEXT = 2_500;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

export function elevenLabsConfigured() { return Boolean(process.env.ELEVENLABS_API_KEY?.trim()); }

export function elevenLabsVoice() {
  const voice = process.env.ELEVENLABS_VOICE_ID?.trim() || "JBFqnCBsd6RMkjVDRZzb";
  if (!/^[A-Za-z0-9]{10,40}$/.test(voice)) throw new Error("ELEVENLABS_VOICE_ID is not a valid voice id");
  return voice;
}

/** Text that will actually be spoken: markdown and code removed, trimmed to a sensible length. */
export function speakableText(text: string) {
  return text.replace(/```[\s\S]*?```/g, " (code shown on screen) ").replace(/`([^`]+)`/g, "$1").replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#*_>~]+/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
}

export async function elevenLabsSynthesize(text: string, signal?: AbortSignal): Promise<{ audio: string; mimeType: string; engine: string; model: string; language: string; offline: boolean; voiceProfile: string; characters: number }> {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) throw new Error("ElevenLabs is not configured");
  const spoken = speakableText(text);
  if (!spoken) throw new Error("there is nothing to read aloud");
  const voice = elevenLabsVoice();
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_flash_v2_5";
  const url = new URL(API + voice);
  url.searchParams.set("output_format", "mp3_44100_128");
  const response = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text: spoken, model_id: modelId }),
    redirect: "error",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    if (response.status === 401) throw new Error("ElevenLabs rejected the API key");
    if (response.status === 429) throw new Error("ElevenLabs is busy or the monthly credits are used up");
    throw new Error(`ElevenLabs returned HTTP ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_AUDIO_BYTES) throw new Error("ElevenLabs returned no audio");
  return { audio: bytes.toString("base64"), mimeType: "audio/mpeg", engine: "ElevenLabs", model: modelId, language: "en", offline: false, voiceProfile: voice, characters: spoken.length };
}

/** Length in seconds of a 16 kHz mono 16-bit WAV (what the browser sends), or null when it isn't one. */
export function wavSeconds(audio: Buffer) {
  if (audio.length < 44 || audio.toString("ascii", 0, 4) !== "RIFF" || audio.toString("ascii", 8, 12) !== "WAVE") return null;
  const rate = audio.readUInt32LE(24);
  const bytesPerSecond = audio.readUInt32LE(28);
  if (!rate || !bytesPerSecond || bytesPerSecond > 1_000_000) return null;
  return (audio.length - 44) / bytesPerSecond;
}

/** Turns recorded speech (a WAV file) into text with ElevenLabs Scribe. */
export async function elevenLabsTranscribe(audio: Buffer, languageCode?: string, signal?: AbortSignal) {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) throw new Error("ElevenLabs is not configured");
  const form = new FormData();
  form.set("model_id", process.env.ELEVENLABS_STT_MODEL_ID?.trim() || "scribe_v1");
  form.set("tag_audio_events", "false");
  if (languageCode && /^[a-z]{2,3}$/.test(languageCode)) form.set("language_code", languageCode);
  form.set("file", new Blob([new Uint8Array(audio)], { type: "audio/wav" }), "speech.wav");
  const response = await fetch(STT_API, {
    method: "POST",
    headers: { "xi-api-key": key, accept: "application/json" },
    body: form,
    redirect: "error",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(45_000)]) : AbortSignal.timeout(45_000),
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    if (response.status === 401) throw new Error("ElevenLabs rejected the API key");
    if (response.status === 429) throw new Error("ElevenLabs is busy or the monthly credits are used up");
    throw new Error(`ElevenLabs speech-to-text returned HTTP ${response.status}`);
  }
  const data = await response.json().catch(() => null) as { text?: unknown; language_code?: unknown } | null;
  const text = typeof data?.text === "string" ? data.text.trim().slice(0, 20_000) : "";
  return { text, language: typeof data?.language_code === "string" ? data.language_code : languageCode ?? "", engine: "ElevenLabs Scribe" };
}
