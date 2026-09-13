from __future__ import annotations

import argparse
import base64
import binascii
import hmac
import io
import json
import os
import socket
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import torch
from PIL import Image, UnidentifiedImageError

from specialist_models import SPECIALISTS, make_model

MAX_BODY = 16 * 1024 * 1024
MAX_TEXT = 512
MAX_IMAGE_BASE64 = 512 * 1024
MAX_MEL_FRAMES = 4000
MAX_TTS_FRAMES = 2000
MAX_CONCURRENT_INFERENCES = 4


def load(kind: str, path: Path):
    payload = torch.load(path, map_location="cpu", weights_only=True)
    if not isinstance(payload, dict) or not isinstance(payload.get("state_dict"), dict):
        raise ValueError("invalid specialist checkpoint")
    model = make_model(kind)
    model.load_state_dict(payload["state_dict"], strict=True)
    model.eval()
    return model


def ids(text: str, max_len: int = MAX_TEXT):
    raw = text.encode("utf-8")[: max_len - 2]
    return torch.tensor([[*raw, 257]], dtype=torch.long)


def image_tensor(data: bytes):
    if len(data) > 512 * 1024:
        raise ValueError("image too large")
    try:
        with Image.open(io.BytesIO(data)) as image:
            image.verify()
        with Image.open(io.BytesIO(data)) as image:
            image = image.convert("RGB").resize((32, 32))
            values = torch.tensor(list(image.getdata()), dtype=torch.float32).view(32, 32, 3) / 255.0
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ValueError("invalid image") from exc
    return values.permute(2, 0, 1).unsqueeze(0)


def finite_vector(value, *, name: str, dim: int = 128):
    if not isinstance(value, list) or len(value) != dim or not all(isinstance(x, (int, float)) for x in value):
        raise ValueError(f"{name} must be a vector of length {dim}")
    tensor = torch.tensor([value], dtype=torch.float32)
    if not torch.isfinite(tensor).all():
        raise ValueError(f"{name} contains non-finite values")
    return tensor


def mel_tensor(value, *, name: str = "mel", max_frames: int = MAX_MEL_FRAMES):
    if not isinstance(value, list) or len(value) != 80 or not value or len(value[0]) > max_frames:
        raise ValueError(f"{name} must be [80,time] with at most {max_frames} frames")
    if any(not isinstance(row, list) or len(row) != len(value[0]) for row in value):
        raise ValueError(f"{name} has inconsistent frame lengths")
    tensor = torch.tensor([value], dtype=torch.float32)
    if not torch.isfinite(tensor).all():
        raise ValueError(f"{name} contains non-finite values")
    return tensor


def response(kind: str, model, payload: dict):
    if not isinstance(payload, dict):
        raise ValueError("request body must be an object")
    with torch.inference_mode():
        if kind == "embed":
            text = payload.get("text", "")
            if not isinstance(text, str) or len(text) > MAX_TEXT:
                raise ValueError("text is too long")
            vector = model(ids(text))[0].tolist()
            return {"kind": kind, "model": SPECIALISTS[kind].name, "vector": vector}
        if kind == "reranker":
            query = finite_vector(payload.get("query"), name="query")
            document = finite_vector(payload.get("document"), name="document")
            score = float(torch.sigmoid(model(query, document))[0])
            return {"kind": kind, "model": SPECIALISTS[kind].name, "score": score}
        if kind == "vision":
            encoded = payload.get("imageBase64")
            if not isinstance(encoded, str) or len(encoded) > MAX_IMAGE_BASE64:
                raise ValueError("image payload is too large")
            try:
                raw = base64.b64decode(encoded, validate=True)
            except (ValueError, binascii.Error) as exc:
                raise ValueError("invalid base64 image") from exc
            vector = model(image_tensor(raw))[0].tolist()
            return {"kind": kind, "model": SPECIALISTS[kind].name, "vector": vector}
        if kind == "asr":
            mel = mel_tensor(payload.get("mel"))
            logits = model(mel)[0]
            tokens = logits.argmax(-1).tolist()
            decoded = bytes(max(0, min(255, token - 1)) for token in tokens if token > 0 and token <= 256).decode("utf-8", "ignore")
            return {"kind": kind, "model": SPECIALISTS[kind].name, "text": decoded[:MAX_TEXT]}
        if kind == "tts":
            text = payload.get("text", "")
            if not isinstance(text, str) or len(text) > MAX_TEXT:
                raise ValueError("text is too long")
            x = ids(text)
            requested_frames = payload.get("frames")
            frames = max(8, x.shape[1] * 4) if requested_frames is None else requested_frames
            if not isinstance(frames, int) or frames < 8 or frames > MAX_TTS_FRAMES:
                raise ValueError("frames must be an integer between 8 and 2000")
            mel = model(x, frames)[0].tolist()
            return {"kind": kind, "model": SPECIALISTS[kind].name, "mel": mel}
        if kind == "image":
            prompt = payload.get("prompt", "")
            if not isinstance(prompt, str) or len(prompt) > MAX_TEXT:
                raise ValueError("prompt is too long")
            output = model(ids(prompt))[0].clamp(0, 1)
            raw = (output.permute(1, 2, 0) * 255).byte().numpy().tobytes()
            image = Image.frombytes("RGB", (32, 32), raw)
            buffer = io.BytesIO(); image.save(buffer, format="PNG")
            return {"kind": kind, "model": SPECIALISTS[kind].name, "imageBase64": base64.b64encode(buffer.getvalue()).decode("ascii"), "width": 32, "height": 32}
    raise ValueError("unsupported specialist")


class Handler(BaseHTTPRequestHandler):
    server_version = "BobAI-Specialist/1"
    inference_slots = threading.BoundedSemaphore(MAX_CONCURRENT_INFERENCES)

    def log_message(self, *_args):
        return

    def do_GET(self):
        if self.path != "/health":
            self.send_error(404); return
        self.send_json(200, {"status": "ok", "kind": self.server.kind})

    def do_POST(self):
        if self.path != "/infer":
            self.send_error(404); return
        provided = self.headers.get("authorization", "")
        expected = f"Bearer {self.server.token}"
        if not hmac.compare_digest(provided, expected):
            self.send_error(401); return
        if not self.inference_slots.acquire(timeout=15):
            self.send_json(429, {"error": "inference concurrency limit reached"}); return
        try:
            raw_length = self.headers.get("content-length")
            if raw_length is None:
                self.send_error(411); return
            try:
                length = int(raw_length)
            except ValueError:
                self.send_error(400); return
            if length <= 0 or length > MAX_BODY:
                self.send_error(413); return
            payload = json.loads(self.rfile.read(length))
            self.send_json(200, response(self.server.kind, self.server.model, payload))
        except json.JSONDecodeError:
            self.send_json(400, {"error": "invalid JSON"})
        except (ValueError, TypeError) as exc:
            self.send_json(400, {"error": str(exc)[:500]})
        except Exception:
            self.send_json(500, {"error": "inference failed"})
        finally:
            self.inference_slots.release()

    def send_json(self, status: int, value: dict):
        data = json.dumps(value, separators=(",", ":")).encode()
        self.send_response(status); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(data))); self.send_header("cache-control", "no-store"); self.send_header("x-content-type-options", "nosniff"); self.end_headers(); self.wfile.write(data)


class BoundedHTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def get_request(self):
        request, client = super().get_request()
        request.settimeout(15.0)
        return request, client


def main():
    parser = argparse.ArgumentParser(); parser.add_argument("kind", choices=sorted(SPECIALISTS)); parser.add_argument("--model", required=True); parser.add_argument("--host", default="127.0.0.1"); parser.add_argument("--port", type=int, required=True); parser.add_argument("--token", required=True)
    args = parser.parse_args()
    if not args.token or len(args.token) < 32:
        raise SystemExit("--token must be at least 32 characters")
    if not 1 <= args.port <= 65535:
        raise SystemExit("--port must be between 1 and 65535")
    path = Path(args.model).resolve()
    if not path.is_file(): raise SystemExit(f"model not found: {path}")
    server = BoundedHTTPServer((args.host, args.port), Handler); server.kind = args.kind; server.model = load(args.kind, path); server.token = args.token
    print(json.dumps({"status": "ready", "kind": args.kind, "port": args.port}), flush=True); server.serve_forever()


if __name__ == "__main__": main()
