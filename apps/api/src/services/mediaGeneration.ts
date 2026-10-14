import { assertMediaPromptSafe } from "./mediaSafety.js";
import { fluxGenerate } from "./flux.js";

type GeneratedImage = { url: string; prompt: string; index: number; seed?: number; width?: number; height?: number };
type MediaOptions = { prompt: string; count?: number; width?: number; height?: number; seed?: number };
const MAX_PROMPT_LENGTH = 8000;
const MAX_INPUT_IMAGES = 4;
function normalizeImages(inputImages: string[] | undefined) { if (inputImages === undefined) return []; if (!Array.isArray(inputImages) || inputImages.length > MAX_INPUT_IMAGES) throw new Error("up to 4 input images are supported"); return inputImages.map((image) => { if (typeof image !== "string" || image.length > 2_800_000 || !/^data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(image)) throw new Error("reference images must be PNG, JPEG, or WebP data URLs under 2 MB"); return image; }); }
export async function generateImages(prompt:string,count=1,inputImages?:string[],signal?:AbortSignal,options: { width?: number; height?: number; seed?: number } = {}):Promise<GeneratedImage[]> {
 const normalized=prompt.trim();
 if(!normalized)throw new Error("image prompt is required");
 if(normalized.length>MAX_PROMPT_LENGTH)throw new Error("image prompt is too long");
 assertMediaPromptSafe(normalized);
 const images=normalizeImages(inputImages);
 const requested=Math.max(1,Math.min(4,Math.floor(count)));
 const width=options.width ?? 512, height=options.height ?? 512, seed=options.seed;
 if(!Number.isInteger(width)||width<256||width>768||width%8!==0||!Number.isInteger(height)||height<256||height>768||height%8!==0) throw new Error("image width and height must be multiples of 8 between 256 and 768");
 if(seed!==undefined&&(!Number.isInteger(seed)||seed<0||seed>2_147_483_647)) throw new Error("image seed must be an integer between 0 and 2147483647");
 if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("image generation cancelled");
 const generated=await fluxGenerate(normalized,requested,images,signal,{width,height,seed});
 if(generated?.length)return generated;
 throw new Error("image generation is unavailable; configure a supported image-generation provider");
}
export async function generateVideo(prompt:string,inputImages?:string[]){const normalized=prompt.trim();if(!normalized)throw new Error("video prompt is required");if(normalized.length>MAX_PROMPT_LENGTH)throw new Error("video prompt is too long");assertMediaPromptSafe(normalized);normalizeImages(inputImages);throw new Error("local video generation requires a video model/runtime; BobAI does not fake video output");}
