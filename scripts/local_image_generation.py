from __future__ import annotations

import base64
import json
import os
import sys
from pathlib import Path

MAX_PROMPT = 8000
MAX_COUNT = 4
MAX_SIDE = 768
MAX_REQUEST_BYTES = 12 * 1024 * 1024
MAX_INPUT_IMAGE_BYTES = 2 * 1024 * 1024
MAX_INPUT_IMAGES = 4
MAX_INPUT_PIXELS = 16_000_000


def main() -> int:
    raw = sys.stdin.read(MAX_REQUEST_BYTES + 1)
    if len(raw.encode("utf-8")) > MAX_REQUEST_BYTES:
        print(json.dumps({"error": "request exceeds the 12 MB image payload limit"}))
        return 2
    try:
        request = json.loads(raw)
    except Exception:
        print(json.dumps({"error": "invalid request"}))
        return 2
    prompt = request.get("prompt")
    count = request.get("count", 1)
    width = request.get("width", 512)
    height = request.get("height", 512)
    seed = request.get("seed")
    steps = request.get("steps", 24)
    guidance_scale = request.get("guidanceScale", 7.0)
    negative_prompt = request.get("negativePrompt", "")
    input_images = request.get("inputImages", [])
    if not isinstance(input_images, list) or len(input_images) > MAX_INPUT_IMAGES:
        print(json.dumps({"error": "up to 4 reference images are supported"}))
        return 2
    if not isinstance(prompt, str) or not prompt.strip() or len(prompt) > MAX_PROMPT:
        print(json.dumps({"error": "prompt must be 1-8000 characters"}))
        return 2
    if not isinstance(count, int) or isinstance(count, bool) or not 1 <= count <= MAX_COUNT:
        print(json.dumps({"error": "count must be between 1 and 4"}))
        return 2
    if any(not isinstance(v, int) or isinstance(v, bool) or v < 256 or v > MAX_SIDE or v % 8 for v in (width, height)):
        print(json.dumps({"error": "width and height must be multiples of 8 between 256 and 768"}))
        return 2
    if not isinstance(steps, int) or isinstance(steps, bool) or not 10 <= steps <= 50:
        print(json.dumps({"error": "steps must be an integer between 10 and 50"}))
        return 2
    if not isinstance(guidance_scale, (int, float)) or isinstance(guidance_scale, bool) or not 1 <= guidance_scale <= 15:
        print(json.dumps({"error": "guidanceScale must be a number between 1 and 15"}))
        return 2
    if not isinstance(negative_prompt, str) or len(negative_prompt) > 2000:
        print(json.dumps({"error": "negativePrompt must be text under 2000 characters"}))
        return 2

    model_path = os.environ.get("BOBAI_IMAGE_MODEL_PATH", "").strip()
    if not model_path or not Path(model_path).is_dir():
        print(json.dumps({"error": "local image model directory is missing; set BOBAI_IMAGE_MODEL_PATH to a downloaded Diffusers model folder"}))
        return 3

    try:
        import torch
        from io import BytesIO
        from PIL import Image, ImageOps
        if input_images:
            from diffusers import AutoPipelineForImage2Image
        else:
            from diffusers import DiffusionPipeline

        model = Path(model_path).resolve()
        use_cuda = torch.cuda.is_available()
        dtype = torch.float16 if use_cuda else torch.float32
        if input_images:
            pipe = AutoPipelineForImage2Image.from_pretrained(
                str(model),
                local_files_only=True,
                torch_dtype=dtype,
            )
        else:
            pipe = DiffusionPipeline.from_pretrained(
                str(model),
                local_files_only=True,
                torch_dtype=dtype,
            )

        decoded_images = []
        for data_url in input_images:
            if not isinstance(data_url, str) or len(data_url) > 2_800_000:
                raise ValueError("reference image must be a PNG, JPEG, or WebP data URL under 2 MB")
            import re
            match = re.fullmatch(r"data:image/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/]+={0,2})", data_url, re.IGNORECASE)
            if not match:
                raise ValueError("reference image data URL is invalid")
            try:
                image_bytes = base64.b64decode(match.group(2), validate=True)
            except Exception as exc:
                raise ValueError("reference image base64 is invalid") from exc
            if not image_bytes or len(image_bytes) > MAX_INPUT_IMAGE_BYTES:
                raise ValueError("reference image must be under 2 MB")
            image = Image.open(BytesIO(image_bytes))
            expected_format = {"jpg": "JPEG", "jpeg": "JPEG", "png": "PNG", "webp": "WEBP"}[match.group(1).lower()]
            if image.format != expected_format:
                raise ValueError("reference image MIME does not match its content")
            if image.width < 1 or image.height < 1 or image.width * image.height > MAX_INPUT_PIXELS:
                raise ValueError("reference image dimensions exceed the supported limit")
            image.load()
            image = ImageOps.exif_transpose(image).convert("RGB").resize((width, height), Image.Resampling.LANCZOS)
            decoded_images.append(image)
        if use_cuda:
            pipe = pipe.to("cuda")
            try:
                pipe.enable_attention_slicing()
            except Exception:
                pass
        else:
            pipe = pipe.to("cpu")
            try:
                pipe.enable_attention_slicing()
                pipe.enable_vae_slicing()
            except Exception:
                pass

        outputs = []
        for index in range(count):
            current_seed = (int(seed) + index) & 0x7FFFFFFF if isinstance(seed, int) and not isinstance(seed, bool) else int.from_bytes(os.urandom(4), "big") & 0x7FFFFFFF
            generator = torch.Generator(device="cuda" if use_cuda else "cpu").manual_seed(current_seed)
            if decoded_images:
                result = pipe(
                    prompt=prompt.strip(),
                    image=decoded_images[index % len(decoded_images)],
                    strength=0.65,
                    num_inference_steps=steps,
                    guidance_scale=float(guidance_scale),
                    negative_prompt=negative_prompt.strip() or None,
                    generator=generator,
                )
            else:
                result = pipe(
                    prompt=prompt.strip(),
                    width=width,
                    height=height,
                    num_inference_steps=steps,
                    guidance_scale=float(guidance_scale),
                    generator=generator,
                )
            image = result.images[0]
            output = BytesIO()
            image.save(output, format="PNG", optimize=True)
            outputs.append({"url": "data:image/png;base64," + base64.b64encode(output.getvalue()).decode("ascii"), "prompt": prompt.strip(), "index": index, "seed": current_seed, "width": width, "height": height})
        print(json.dumps({"images": outputs}, separators=(",", ":")))
        return 0
    except Exception as exc:
        # Do not dump environment variables, model paths, or full tracebacks into API responses.
        print(json.dumps({"error": f"local image generation failed: {type(exc).__name__}"}))
        return 4


if __name__ == "__main__":
    raise SystemExit(main())
