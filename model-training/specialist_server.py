from __future__ import annotations

import argparse
import base64
import io
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import torch
import torch.nn.functional as F
from PIL import Image

from specialist_models import SPECIALISTS, make_model

MAX_BODY = 16 * 1024 * 1024


def load(kind: str, path: Path):
    payload = torch.load(path, map_location="cpu", weights_only=True)
    model = make_model(kind)
    model.load_state_dict(payload["state_dict"])
    model.eval()
    return model


def ids(text: str, max_len: int = 512):
    raw = text.encode("utf-8")[: max_len - 2]
    return torch.tensor([[*raw, 257]], dtype=torch.long)


def image_tensor(data: bytes):
    image = Image.open(io.BytesIO(data)).convert("RGB").resize((32, 32))
    values = torch.tensor(list(image.getdata()), dtype=torch.float32).view(32, 32, 3) / 255.0
    return values.permute(2, 0, 1).unsqueeze(0)


def response(kind: str, model, payload: dict):
    with torch.inference_mode():
        if kind == "embed":
            vector = model(ids(str(payload.get("text", ""))))[0].tolist()
            return {"kind": kind, "model": SPECIALISTS[kind].name, "vector": vector}
        if kind == "reranker":
            query = torch.tensor([payload["query"]], dtype=torch.float32)
            document = torch.tensor([payload["document"]], dtype=torch.float32)
            score = float(torch.sigmoid(model(query, document))[0])
            return {"kind": kind, "model": SPECIALISTS[kind].name, "score": score}
        if kind == "vision":
            raw = base64.b64decode(payload["imageBase64"], validate=True)
            vector = model(image_tensor(raw))[0].tolist()
            return {"kind": kind, "model": SPECIALISTS[kind].name, "vector": vector}
        if kind == "asr":
            mel = torch.tensor(payload["mel"], dtype=torch.float32).unsqueeze(0)
            logits = model(mel)[0]
            tokens = logits.argmax(-1).tolist()
            decoded = bytes(max(0, min(255, token - 1)) for token in tokens if token > 0 and token <= 256).decode("utf-8", "ignore")
            return {"kind": kind, "model": SPECIALISTS[kind].name, "text": decoded}
        if kind == "tts":
            x = ids(str(payload.get("text", "")))
            frames = int(payload.get("frames", max(8, x.shape[1] * 4)))
            mel = model(x, frames)[0].tolist()
            return {"kind": kind, "model": SPECIALISTS[kind].name, "mel": mel}
        if kind == "image":
            output = model(ids(str(payload.get("prompt", ""))))[0].clamp(0, 1)
            raw = (output.permute(1, 2, 0) * 255).byte().numpy().tobytes()
            image = Image.frombytes("RGB", (32, 32), raw)
            buffer = io.BytesIO(); image.save(buffer, format="PNG")
            return {"kind": kind, "model": SPECIALISTS[kind].name, "imageBase64": base64.b64encode(buffer.getvalue()).decode("ascii"), "width": 32, "height": 32}
    raise ValueError("unsupported specialist")


class Handler(BaseHTTPRequestHandler):
    server_version = "BobAI-Specialist/1"

    def log_message(self, *_args):
        return

    def do_GET(self):
        if self.path != "/health":
            self.send_error(404); return
        self.send_json(200, {"status": "ok", "kind": self.server.kind})

    def do_POST(self):
        if self.path != "/infer":
            self.send_error(404); return
        if self.headers.get("authorization") != f"Bearer {self.server.token}":
            self.send_error(401); return
        try:
            length = int(self.headers.get("content-length", "0"))
            if length < 0 or length > MAX_BODY: raise ValueError("body too large")
            payload = json.loads(self.rfile.read(length))
            self.send_json(200, response(self.server.kind, self.server.model, payload))
        except Exception as exc:
            self.send_json(400, {"error": str(exc)[:500]})

    def send_json(self, status: int, value: dict):
        data = json.dumps(value, separators=(",", ":")).encode()
        self.send_response(status); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(data))); self.send_header("cache-control", "no-store"); self.end_headers(); self.wfile.write(data)


def main():
    parser = argparse.ArgumentParser(); parser.add_argument("kind", choices=sorted(SPECIALISTS)); parser.add_argument("--model", required=True); parser.add_argument("--host", default="127.0.0.1"); parser.add_argument("--port", type=int, required=True); parser.add_argument("--token", required=True)
    args = parser.parse_args(); path = Path(args.model).resolve()
    if not path.is_file(): raise SystemExit(f"model not found: {path}")
    server = ThreadingHTTPServer((args.host, args.port), Handler); server.kind = args.kind; server.model = load(args.kind, path); server.token = args.token
    print(json.dumps({"status": "ready", "kind": args.kind, "port": args.port}), flush=True); server.serve_forever()


if __name__ == "__main__": main()
