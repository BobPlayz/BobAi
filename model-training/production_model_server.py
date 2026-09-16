from __future__ import annotations

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from typing import Any

import torch
from tokenizers import Tokenizer

from production_model import BobProductionLM, ProductionConfig

ROLE_TOKENS = {"system": "<|system|>", "user": "<|user|>", "assistant": "<|assistant|>"}
MAX_BODY = 4 * 1024 * 1024


def format_messages(messages: list[dict[str, Any]]) -> str:
    parts = ["<|bos|>"]
    for message in messages[-100:]:
        role, content = message.get("role"), message.get("content")
        if role in ROLE_TOKENS and isinstance(content, str): parts.append(f"{ROLE_TOKENS[role]}\n{content[:100000]}")
    parts.append("<|assistant|>\n")
    return "\n".join(parts)


class Runtime:
    def __init__(self, checkpoint: Path, tokenizer_path: Path, device_name: str):
        self.tokenizer = Tokenizer.from_file(str(tokenizer_path)); self.device = torch.device("cuda" if device_name == "auto" and torch.cuda.is_available() else device_name if device_name != "auto" else "cpu")
        state = torch.load(checkpoint, map_location=self.device, weights_only=False)
        config = ProductionConfig(**state["config"]); config.gradient_checkpointing = False
        self.model = BobProductionLM(config).to(self.device); self.model.load_state_dict(state["model"]); self.model.eval(); self.config = config
        self.eos_id = self.tokenizer.token_to_id("<|eos|>")

    @torch.inference_mode()
    def infer(self, messages: list[dict[str, Any]], max_tokens: int, temperature: float, top_k: int) -> dict[str, Any]:
        text = format_messages(messages); ids = self.tokenizer.encode(text, add_special_tokens=False).ids[-self.config.context_size:]
        input_ids = torch.tensor([ids], dtype=torch.long, device=self.device)
        output = self.model.generate(input_ids, max_new_tokens=min(max(1, max_tokens), 2048), temperature=min(max(temperature, 0.0), 2.0), top_k=min(max(top_k, 1), 512), eos_id=self.eos_id)
        generated = output[0, input_ids.size(1):].tolist(); content = self.tokenizer.decode(generated, skip_special_tokens=True).strip()
        return {"content": content, "model": "bob-production", "tokens": len(generated)}


def handler(runtime: Runtime, token: str):
    class Handler(BaseHTTPRequestHandler):
        def _json(self, status: int, value: dict[str, Any]):
            body = json.dumps(value, ensure_ascii=False).encode("utf-8"); self.send_response(status); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(body))); self.end_headers(); self.wfile.write(body)
        def _authorized(self) -> bool: return self.headers.get("authorization") == f"Bearer {token}"
        def do_GET(self):
            if self.path != "/health": return self._json(404, {"error": "not found"})
            return self._json(200, {"ready": True, "model": "bob-production", "device": str(runtime.device), "context_size": runtime.config.context_size})
        def do_POST(self):
            if self.path != "/infer": return self._json(404, {"error": "not found"})
            if not self._authorized(): return self._json(401, {"error": "unauthorized"})
            try:
                length = int(self.headers.get("content-length", "0"));
                if length <= 0 or length > MAX_BODY: return self._json(413, {"error": "request too large"})
                payload = json.loads(self.rfile.read(length).decode("utf-8")); messages = payload.get("messages")
                if not isinstance(messages, list) or not messages: return self._json(400, {"error": "messages are required"})
                result = runtime.infer(messages, int(payload.get("max_tokens", 768)), float(payload.get("temperature", 0.7)), int(payload.get("top_k", 50))); return self._json(200, result)
            except Exception as exc: return self._json(500, {"error": str(exc)[:2000]})
        def log_message(self, *_args): return
    return Handler


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve a trained BobAI production checkpoint on localhost for the Node runtime.")
    parser.add_argument("--checkpoint", type=Path, default=Path("model-training/output/bob-production/best.pt")); parser.add_argument("--tokenizer", type=Path, default=Path("model-training/output/bob-production/tokenizer.json")); parser.add_argument("--host", default="127.0.0.1"); parser.add_argument("--port", type=int, default=39850); parser.add_argument("--token", required=True); parser.add_argument("--device", choices=["auto", "cpu", "cuda"], default="auto"); args = parser.parse_args()
    if args.host not in {"127.0.0.1", "localhost"}: raise SystemExit("production model server must bind to localhost")
    runtime = Runtime(args.checkpoint, args.tokenizer, args.device); ThreadingHTTPServer((args.host, args.port), handler(runtime, args.token)).serve_forever()


if __name__ == "__main__": main()
