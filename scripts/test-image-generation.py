from __future__ import annotations

import sys
from pathlib import Path

def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: test-image-generation.py MODEL_DIR OUTPUT_PNG", file=sys.stderr)
        return 2

    model_dir = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve()
    if not (model_dir / "model_index.json").is_file():
        print(f"Model directory is missing model_index.json: {model_dir}", file=sys.stderr)
        return 2

    try:
        import torch
        from diffusers import DiffusionPipeline

        print("Loading local model on CPU. This can take a few minutes...", flush=True)
        pipe = DiffusionPipeline.from_pretrained(
            str(model_dir),
            local_files_only=True,
            torch_dtype=torch.float32,
        )
        pipe = pipe.to("cpu")
        for method in ("enable_attention_slicing", "enable_vae_slicing"):
            try:
                getattr(pipe, method)()
            except Exception:
                pass

        generator = torch.Generator(device="cpu").manual_seed(12345)
        result = pipe(
            prompt="a tiny friendly robot in a futuristic cyan glass laboratory, polished digital illustration",
            width=512,
            height=512,
            num_inference_steps=10,
            guidance_scale=7.0,
            generator=generator,
        )
        if not result.images:
            raise RuntimeError("Diffusers returned no image")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        result.images[0].save(output_path, format="PNG")
        if not output_path.is_file() or output_path.stat().st_size < 1024:
            raise RuntimeError("Generated PNG is missing or unexpectedly small")
        print(f"PASS: generated a real 512x512 PNG: {output_path} ({output_path.stat().st_size} bytes)")
        return 0
    except Exception as exc:
        print(f"FAIL: local image inference failed ({type(exc).__name__}): {exc}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
