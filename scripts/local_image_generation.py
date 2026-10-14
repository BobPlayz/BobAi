from __future__ import annotations

import base64
import json
import os
import sys
from pathlib import Path

MAX_PROMPT = 8000
MAX_COUNT = 4
MAX_SIDE = 768


def main() -> int:
    raw = sys.stdin.read(32_000)
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
    if not isinstance(prompt, str) or not prompt.strip() or len(prompt) > MAX_PROMPT:
        print(json.dumps({"error": "prompt must be 1-8000 characters"}))
        return 2
    if not isinstance(count, int) or isinstance(count, bool) or not 1 <= count <= MAX_COUNT:
        print(json.dumps({"error": "count must be between 1 and 4"}))
        return 2
    if any(not isinstance(v, int) or isinstance(v, bool) or v < 256 or v > MAX_SIDE or v % 8 for v in (width, height)):
        print(json.dumps({"error": "width and height must be multiples of 8 between 256 and 768"}))
        return 2
    model_path = os.environ.get("BOBAI_IMAGE_MODEL_PATH", "").strip()
    if not model_path or not Path(model_path).is_dir():
        print(json.dumps({"error": "local image model directory is missing; set BOBAI_IMAGE_MODEL_PATH to a downloaded Diffusers model folder"}))
        return 3

    try:
        import torch
        from diffusers import DiffusionPipeline

        model = Path(model_path).resolve()
        use_cuda = torch.cuda.is_available()
        dtype = torch.float16 if use_cuda else torch.float32
        pipe = DiffusionPipeline.from_pretrained(
            str(model),
            local_files_only=True,
            torch_dtype=dtype,
            safety_checker=None,
            requires_safety_checker=False,
        )
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
            current_seed = int(seed) + index if isinstance(seed, int) and not isinstance(seed, bool) else int.from_bytes(os.urandom(4), "big")
            generator = torch.Generator(device="cuda" if use_cuda else "cpu").manual_seed(current_seed)
            result = pipe(
                prompt=prompt.strip(),
                width=width,
                height=height,
                num_inference_steps=20,
                guidance_scale=7.0,
                generator=generator,
            )
            image = result.images[0]
            from io import BytesIO
            output = BytesIO()
            image.save(output, format="PNG", optimize=True)
            outputs.append({"url": "data:image/png;base64," + base64.b64encode(output.getvalue()).decode("ascii"), "prompt": prompt.strip(), "index": index})
        print(json.dumps({"images": outputs}, separators=(",", ":")))
        return 0
    except Exception as exc:
        # Do not dump environment variables, model paths, or full tracebacks into API responses.
        print(json.dumps({"error": f"local image generation failed: {type(exc).__name__}"}))
        return 4


if __name__ == "__main__":
    raise SystemExit(main())
