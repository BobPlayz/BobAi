import { spawn } from "node:child_process";
import path from "node:path";

const MAX_STDOUT_BYTES = 32 * 1024 * 1024;
const TIMEOUT_MS = 10 * 60 * 1000;

export async function fluxGenerate(prompt: string, count: number, inputImages: string[] = [], signal?: AbortSignal) {
  if (inputImages.length) throw new Error("local image editing is not configured yet; BobAI will not send reference images to an external provider");
  const modelPath = process.env.BOBAI_IMAGE_MODEL_PATH?.trim();
  if (!modelPath) throw new Error("local image generation needs BOBAI_IMAGE_MODEL_PATH pointing to a downloaded Diffusers model directory");
  const python = (process.env.BOBAI_PYTHON || "python").trim();
  const scriptPath = path.resolve("scripts/local_image_generation.py");
  const child = spawn(python, [scriptPath], {
    cwd: process.cwd(),
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, BOBAI_IMAGE_MODEL_PATH: path.resolve(modelPath) },
  });
  const stdout: Buffer[] = [];
  let stdoutBytes = 0;
  let settled = false;
  const result = await new Promise<{ images?: Array<{ url: string; prompt: string; index: number }>; error?: string }>((resolve, reject) => {
    const abort = () => { child.kill(); finish(signal?.reason instanceof Error ? signal.reason : new Error("local image generation cancelled")); };
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("local image generation timed out; try one 512x512 image or a smaller local model"));
    }, TIMEOUT_MS);
    const finish = (error?: Error, value?: { images?: Array<{ url: string; prompt: string; index: number }>; error?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (error) reject(error); else resolve(value || {});
    };
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener("abort", abort, { once: true });
    child.once("error", (error) => finish(new Error("could not start local image runtime: " + error.message)));
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_STDOUT_BYTES) {
        child.kill();
        finish(new Error("local image generation output exceeded the size limit"));
        return;
      }
      stdout.push(chunk);
    });
    child.once("close", (code) => {
      if (code !== 0) {
        let message = "";
        try { message = String(JSON.parse(Buffer.concat(stdout).toString("utf8")).error || ""); } catch {}
        finish(new Error(message || (code === null ? "local image runtime was interrupted" : "local image runtime failed; check the optional Python image dependencies and model files")));
        return;
      }
      try {
        const parsed = JSON.parse(Buffer.concat(stdout).toString("utf8")) as { images?: unknown; error?: unknown };
        if (typeof parsed.error === "string") { finish(new Error(parsed.error)); return; }
        if (!Array.isArray(parsed.images) || parsed.images.length !== count) { finish(new Error("local image runtime returned an invalid image list")); return; }
        const images = parsed.images.map((item) => {
          if (!item || typeof item !== "object") throw new Error("local image runtime returned an invalid image");
          const image = item as Record<string, unknown>;
          if (typeof image.url !== "string" || image.url.length > 12 * 1024 * 1024 || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image.url)) throw new Error("local image runtime returned invalid PNG data");
          return { url: image.url, prompt: typeof image.prompt === "string" ? image.prompt.slice(0, 8000) : prompt, index: typeof image.index === "number" ? image.index : 0 };
        });
        finish(undefined, { images });
      } catch (error) { finish(error instanceof Error ? error : new Error("local image runtime returned invalid JSON")); }
    });
    child.stdin.end(JSON.stringify({ prompt, count, width: 512, height: 512 }));
  });
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > MAX_STDOUT_BYTES) throw new Error("local image generation result exceeded the size limit");
  return Array.isArray(result.images) ? result.images : [];
}
