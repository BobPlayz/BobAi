import { specialistConfigured, specialistInfer } from "./specialistRuntime.js";
import { modelRuntime } from "./modelRuntime.js";

export async function fluxGenerate(prompt: string, count: number, inputImages: string[] = []) {
  if (inputImages.length) throw new Error("Local image editing is not configured yet; BobAI will not send reference images to an external provider.");
  if (!specialistConfigured("image")) throw new Error("Local image generation is unavailable. Install/configure BobAI's image model artifact (BOBAI_FLUX_MODEL_PATH); no external provider is used.");
  const release = await modelRuntime.acquire("bob-image-0.1");
  try {
    const results = [];
    for (let index = 0; index < count; index++) {
      const result = await specialistInfer("image", { prompt });
      if (typeof result.imageBase64 !== "string" || !/^[A-Za-z0-9+/=\r\n]+$/.test(result.imageBase64)) throw new Error("local image model returned invalid image data");
      results.push({ url: `data:image/png;base64,${result.imageBase64}`, prompt, index });
    }
    return results;
  } finally { release(); }
}
