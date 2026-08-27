export type MusicRequest = {
  prompt: string;
  lyrics?: string;
  durationSeconds?: number;
  instrumental?: boolean;
  genre?: string;
  mood?: string;
  bpm?: number;
  key?: string;
  seed?: number;
  referenceAudio?: string;
};

export type MusicProvider = {
  generate: (request: MusicRequest) => Promise<unknown>;
  edit?: (request: MusicRequest & { audio: string }) => Promise<unknown>;
  analyze?: (audio: string) => Promise<unknown>;
};

let provider: MusicProvider | null = null;

export const setMusicProvider = (next: MusicProvider | null) => {
  provider = next;
};

export const generateMusic = async (request: MusicRequest) => {
  if (!provider?.generate) throw new Error("music provider is not configured");
  return provider.generate(request);
};

export const editMusic = async (request: MusicRequest & { audio: string }) => {
  if (!provider?.edit) throw new Error("music editing provider is not configured");
  return provider.edit(request);
};

export const analyzeMusic = async (audio: string) => {
  if (!provider?.analyze) throw new Error("music analysis provider is not configured");
  return provider.analyze(audio);
};
