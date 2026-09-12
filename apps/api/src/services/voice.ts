import { piperStatus, synthesizeLocal } from "./bobVoice.js";
import { transcribeLocal, whisperStatus } from "./whisperCpp.js";

export type VoiceProvider = {
  transcribe?: (input: Buffer, options?: Record<string, unknown>) => Promise<unknown>;
  synthesize?: (text: string, options?: Record<string, unknown>) => Promise<unknown>;
};

let provider: VoiceProvider | null = null;
export const setVoiceProvider = (next: VoiceProvider | null) => { provider = next; };

export const transcribe = async (input: Buffer, options?: Record<string, unknown>) => provider?.transcribe ? provider.transcribe(input, options) : transcribeLocal(input, options);
export const synthesize = async (text: string, options?: Record<string, unknown>) => provider?.synthesize ? provider.synthesize(text, options) : synthesizeLocal(text, options);
export const status = async () => ({ local: { whisper: await whisperStatus(), piper: await piperStatus() }, externalProviderConfigured: Boolean(provider) });
