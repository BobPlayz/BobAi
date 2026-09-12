from __future__ import annotations

import argparse
import json
import struct
from datetime import datetime, timezone
from pathlib import Path

import torch

from native_model import ASSISTANT, BOS, BobNativeLM, encode_messages

ROOT = Path(__file__).resolve().parent


def load_native(path: Path) -> BobNativeLM:
    raw = path.read_bytes()
    if raw[:8] != b"BOBAI001":
        raise SystemExit("invalid native model file")
    header_len = struct.unpack("<I", raw[8:12])[0]
    header = json.loads(raw[12:12 + header_len].decode("utf-8"))
    data_start = (12 + header_len + 3) & ~3
    model = BobNativeLM()
    state = model.state_dict()
    for spec in header["tensors"]:
        name = spec["name"]
        if name not in state:
            raise SystemExit(f"model tensor {name} is not supported by this runtime")
        start = data_start + int(spec["offset"])
        count = int(spec["count"])
        values = torch.frombuffer(memoryview(raw)[start:start + count * 4], dtype=torch.float32).clone().reshape(tuple(spec["shape"]))
        state[name] = values
    model.load_state_dict(state)
    model.eval()
    return model


def generate(model: BobNativeLM, messages: list[dict], max_new_tokens: int = 160) -> str:
    ids = [BOS]
    for message in messages:
        ids.extend(encode_messages([{"role": message["role"], "content": message["content"]}])[1:-1])
    ids.append(ASSISTANT)
    with torch.no_grad():
        for _ in range(max_new_tokens):
            inp = torch.tensor([ids[-128:]], dtype=torch.long)
            logits = model(inp)[0, -1]
            for token in (256, 258, 259, 260):
                logits[token] = -1e9
            next_token = int(torch.argmax(logits).item())
            if next_token == 257:
                break
            ids.append(next_token)
    generated = [token for token in ids if token < 256]
    prompt_bytes = b"".join(bytes([token]) for token in generated)
    marker = messages[-1]["content"].encode("utf-8") if messages else b""
    text = prompt_bytes.decode("utf-8", errors="ignore")
    if marker and marker.decode("utf-8", errors="ignore") in text:
        text = text.split(marker.decode("utf-8", errors="ignore"), 1)[-1]
    return text.strip()


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate a BobAI native model without an external inference server.")
    parser.add_argument("--model", type=Path, default=ROOT / "output/bob-0.1-native/model.bob")
    parser.add_argument("--output", type=Path, default=ROOT / "output/evaluation.json")
    args = parser.parse_args()
    if not args.model.exists():
        raise SystemExit("Train a native Bob model first or pass --model.")
    model = load_native(args.model)
    prompts = [json.loads(line) for line in (ROOT / "eval/prompts.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
    results = []
    for prompt in prompts:
        response = generate(model, prompt["messages"])
        results.append({"id": prompt["id"], "response": response, "passed": bool(response.strip())})
    passed = sum(1 for item in results if item["passed"])
    report = {"model_id": "bob-0.1-native", "evaluated_at": datetime.now(timezone.utc).isoformat(), "passed": passed, "total": len(results), "pass_rate": passed / len(results) if results else 0.0, "results": results}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
