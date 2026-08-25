function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateImages(prompt: string) {
  const normalized = prompt.trim();
  if (!normalized) throw new Error("image prompt is required");

  const encoded = encodeURIComponent(normalized);
  const images: { url: string; prompt: string }[] = [];

  for (let i = 0; i < 4; i++) {
    images.push({
      url: `https://image.pollinations.ai/prompt/${encoded}?model=flux&width=1024&height=1024&seed=${Date.now() + i * 9999}&nologo=true`,
      prompt: normalized,
    });
    if (i < 3) await sleep(1200);
  }

  return images;
}
