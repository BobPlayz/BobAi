import { generateImage } from "@/lib/api";

export async function regenerateImage(
  prompt: string
) {
  return generateImage(prompt);
}