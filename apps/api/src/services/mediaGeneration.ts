import { assertMediaPromptSafe } from "./mediaSafety.js";
import { fluxGenerate } from "./flux.js";

type GeneratedImage = { url: string; prompt: string; index: number; seed?: number; width?: number; height?: number };
type MediaOptions = { prompt: string; count?: number; width?: number; height?: number; seed?: number };
const MAX_PROMPT_LENGTH = 8000;
const MAX_INPUT_IMAGES = 4;
function normalizeImages(inputImages: string[] | undefined) {
 if (inputImages === undefined) return [];
 if (!Array.isArray(inputImages) || inputImages.length > MAX_INPUT_IMAGES) throw new Error("up to 4 input images are supported");
 return inputImages.map((image) => {
  if (typeof image !== "string" || image.length > 2_800_000) throw new Error("reference images must be PNG, JPEG, or WebP data URLs under 2 MB");
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(image);
  if (!match) throw new Error("reference images must be PNG, JPEG, or WebP data URLs under 2 MB");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 2 * 1024 * 1024 || bytes.toString("base64").replace(/=+$/, "") !== match[2].replace(/=+$/, "")) throw new Error("reference images must be PNG, JPEG, or WebP data URLs under 2 MB");
  const mime = match[1].toLowerCase();
  const valid = mime === "png" ? bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
   : mime === "webp" ? bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP"
   : bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!valid) throw new Error("reference image MIME does not match its content");
  return image;
 });
}
export async function generateImages(prompt:string,count=1,inputImages?:string[],signal?:AbortSignal,options: { width?: number; height?: number; seed?: number; steps?: number; guidanceScale?: number; negativePrompt?: string } = {}):Promise<GeneratedImage[]> {
 const normalized=prompt.trim();
 if(!normalized)throw new Error("image prompt is required");
 if(normalized.length>MAX_PROMPT_LENGTH)throw new Error("image prompt is too long");
 assertMediaPromptSafe(normalized);
 const images=normalizeImages(inputImages);
 if(!Number.isInteger(count)||count<1||count>4) throw new Error("image count must be an integer between 1 and 4");
 const requested=count;
 const width=options.width ?? 512, height=options.height ?? 512, seed=options.seed;
 const steps=options.steps ?? 24, guidanceScale=options.guidanceScale ?? 7, negativePrompt=options.negativePrompt ?? "";
 if(!Number.isInteger(steps)||steps<10||steps>50) throw new Error("image steps must be an integer between 10 and 50");
 if(typeof guidanceScale!=="number"||!Number.isFinite(guidanceScale)||guidanceScale<1||guidanceScale>15) throw new Error("image guidance scale must be a number between 1 and 15");
 if(typeof negativePrompt!=="string"||negativePrompt.length>2000) throw new Error("image negative prompt must be text under 2000 characters");
 if(!Number.isInteger(width)||width<256||width>768||width%8!==0||!Number.isInteger(height)||height<256||height>768||height%8!==0) throw new Error("image width and height must be multiples of 8 between 256 and 768");
 if(seed!==undefined&&(!Number.isInteger(seed)||seed<0||seed>2_147_483_647)) throw new Error("image seed must be an integer between 0 and 2147483647");
 if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("image generation cancelled");
 const generated=await fluxGenerate(normalized,requested,images,signal,{width,height,seed,steps,guidanceScale,negativePrompt});
 if(generated?.length)return generated;
 throw new Error("image generation is unavailable; configure a supported image-generation provider");
}
export async function generateVideo(prompt:string,inputImages?:string[]){const normalized=prompt.trim();if(!normalized)throw new Error("video prompt is required");if(normalized.length>MAX_PROMPT_LENGTH)throw new Error("video prompt is too long");assertMediaPromptSafe(normalized);normalizeImages(inputImages);throw new Error("local video generation requires a video model/runtime; BobAI does not fake video output");}
