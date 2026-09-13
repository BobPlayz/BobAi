import { specialistConfigured, specialistInfer } from "./specialistRuntime.js";
import { modelRuntime } from "./modelRuntime.js";

export async function fluxGenerate(prompt: string, count: number) {
  if (!specialistConfigured("image")) return null;
  const release = await modelRuntime.acquire("bob-image-0.1");
  try {
    const results = [];
    for (let index = 0; index < count; index++) {
      const result = await specialistInfer("image", { prompt });
      if (typeof result.imageBase64 !== "string") throw new Error("Flux returned invalid output");
      results.push({ url: `data:image/png;base64,${result.imageBase64}`, prompt, index });
    }
    return results;
  } finally { release(); }
}
