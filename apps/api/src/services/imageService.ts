export interface GeneratedImage {
  url: string;
  prompt: string;
}

const COMFYUI_URL =
  process.env.COMFYUI_URL || "http://127.0.0.1:8188";

async function waitForImages(promptId: string) {
  for (let i = 0; i < 120; i++) {
    const response = await fetch(
      `${COMFYUI_URL}/history/${promptId}`
    );

    if (response.ok) {
      const history = await response.json();

      if (history?.[promptId]) {
        return history[promptId];
      }
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 1000)
    );
  }

  throw new Error("image generation timed out");
}

export async function generateImages(
  prompt: string
): Promise<GeneratedImage[]> {
  const workflow = {
    1: {
      class_type: "KSampler",
      inputs: {
        seed: Math.floor(Math.random() * 1_000_000_000),
        steps: 28,
        cfg: 7,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 1,
        model: ["4", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["5", 0],
      },
    },
    4: {
      class_type: "CheckpointLoaderSimple",
      inputs: {
        ckpt_name: "flux1-dev.safetensors",
      },
    },
    5: {
      class_type: "EmptyLatentImage",
      inputs: {
        width: 1024,
        height: 1024,
        batch_size: 4,
      },
    },
    6: {
      class_type: "CLIPTextEncode",
      inputs: {
        text: prompt,
        clip: ["4", 1],
      },
    },
    7: {
      class_type: "CLIPTextEncode",
      inputs: {
        text: "blurry, low quality, deformed, watermark, text, logo",
        clip: ["4", 1],
      },
    },
    8: {
      class_type: "VAEDecode",
      inputs: {
        samples: ["1", 0],
        vae: ["4", 2],
      },
    },
    9: {
      class_type: "SaveImage",
      inputs: {
        filename_prefix: "bobai",
        images: ["8", 0],
      },
    },
  };

  try {
    const queue = await fetch(`${COMFYUI_URL}/prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: workflow,
      }),
    });

    if (!queue.ok) {
      throw new Error("failed to queue workflow");
    }

    const queued = (await queue.json()) as {
      prompt_id: string;
    };

    const history = await waitForImages(queued.prompt_id);

    const outputs = history.outputs ?? {};

    const images: GeneratedImage[] = [];

    for (const node of Object.values(outputs) as any[]) {
      if (!node.images) continue;

      for (const image of node.images) {
        images.push({
          url:
            `${COMFYUI_URL}/view?filename=` +
            `${encodeURIComponent(image.filename)}` +
            `&subfolder=${encodeURIComponent(image.subfolder || "")}` +
            `&type=${image.type}`,
          prompt,
        });
      }
    }

    if (images.length > 0) {
      return images;
    }

    throw new Error("no images returned");
  } catch {
    const seed = encodeURIComponent(prompt.trim());

    return [
      {
        url: `https://picsum.photos/seed/${seed}/1024/1024`,
        prompt,
      },
      {
        url: `https://picsum.photos/seed/${seed}-2/1024/1024`,
        prompt,
      },
      {
        url: `https://picsum.photos/seed/${seed}-3/1024/1024`,
        prompt,
      },
      {
        url: `https://picsum.photos/seed/${seed}-4/1024/1024`,
        prompt,
      },
    ];
  }
}