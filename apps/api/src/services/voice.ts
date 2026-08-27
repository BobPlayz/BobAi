export type VoiceProvider = {
  transcribe?: (input: Buffer, options?: Record<string, unknown>) => Promise<unknown>;
  synthesize?: (text: string, options?: Record<string, unknown>) => Promise<unknown>;
};

let provider: VoiceProvider | null = null;

export const setVoiceProvider = (next: VoiceProvider | null) => {
  provider = next;
};

export const transcribe = async (input: Buffer, options?: Record<string, unknown>) => {
  if (!provider?.transcribe) throw new Error("voice transcription provider is not configured");
  return provider.transcribe(input, options);
};

export const synthesize = async (text: string, options?: Record<string, unknown>) => {
  if (!provider?.synthesize) throw new Error("voice synthesis provider is not configured");
  return provider.synthesize(text, options);
};
