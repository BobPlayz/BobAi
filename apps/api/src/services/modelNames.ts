export const BOBAI_MODEL_NAMES = {
  bob: "BobAI",
  coder: "coding",
  vision: "vision",
  asr: "speech recognition",
  tts: "speech generation",
  image: "image generation",
  embedding: "embeddings",
  reranking: "reranking",
} as const;

export function getBobModelName(id: string) {
  if (id === "bob" || id === "bob-0.2-native") return BOBAI_MODEL_NAMES.bob;
  if (id === "coder" || id === "coder-fast") return BOBAI_MODEL_NAMES.coder;
  if (id.includes("vision")) return BOBAI_MODEL_NAMES.vision;
  if (id.includes("asr")) return BOBAI_MODEL_NAMES.asr;
  if (id.includes("tts")) return BOBAI_MODEL_NAMES.tts;
  if (id.includes("image")) return BOBAI_MODEL_NAMES.image;
  if (id.includes("embed")) return BOBAI_MODEL_NAMES.embedding;
  if (id.includes("reranker")) return BOBAI_MODEL_NAMES.reranking;
  return id;
}
