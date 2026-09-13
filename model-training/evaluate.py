from __future__ import annotations

import argparse
import json
import math
import struct
from datetime import datetime, timezone
from pathlib import Path

import torch
import torch.nn.functional as F

from native_model import ASSISTANT, BOS, EOS, SYSTEM, USER, BobNativeLM, encode_text, make_batch, role_token, load_rows

ROOT = Path(__file__).resolve().parent
MAGIC = b"BOBAI002"


def load_native(path: Path):
    raw = path.read_bytes()
    if len(raw) < 12 or raw[:8] != MAGIC:
        raise SystemExit("invalid native model file; expected BOBAI002")
    header_len = struct.unpack("<I", raw[8:12])[0]
    if header_len < 2 or header_len > 1_048_576 or 12 + header_len > len(raw):
        raise SystemExit("invalid native model header")
    try:
        header = json.loads(raw[12:12 + header_len].decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise SystemExit("invalid native model header JSON") from error
    if header.get("format") != "bobai-native-transformer" or int(header.get("version", 0)) != 2:
        raise SystemExit("unsupported native model format or version")
    context = int(header["context_size"]); d_model = int(header["d_model"]); heads = int(header["n_heads"]); ffn = int(header["ffn_dim"]); layers = int(header["n_layers"])
    model = BobNativeLM(context, d_model, heads, ffn, layers)
    state = model.state_dict()
    data_start = (12 + header_len + 3) & ~3
    if data_start > len(raw):
        raise SystemExit("native model has no tensor payload")
    for spec in header.get("tensors", []):
        name = spec.get("name")
        if name not in state:
            raise SystemExit(f"model tensor {name} is not supported by this runtime")
        shape = tuple(int(x) for x in spec.get("shape", []))
        count = int(spec.get("count", -1)); offset = int(spec.get("offset", -1))
        if count < 0 or offset < 0 or any(x < 0 for x in shape) or math.prod(shape) != count:
            raise SystemExit(f"invalid tensor metadata for {name}")
        start = data_start + offset; end = start + count * 4
        if start < data_start or end > len(raw) or end < start:
            raise SystemExit(f"tensor payload is outside the model file for {name}")
        values = torch.frombuffer(memoryview(raw)[start:end], dtype=torch.float32).clone().reshape(shape)
        if tuple(values.shape) != tuple(state[name].shape):
            raise SystemExit(f"tensor shape mismatch for {name}: {tuple(values.shape)} != {tuple(state[name].shape)}")
        if not torch.isfinite(values).all():
            raise SystemExit(f"non-finite values found in tensor {name}")
        state[name] = values
    model.load_state_dict(state)
    model.eval()
    return model, header


def prompt_ids(messages):
    ids = [BOS]
    for message in messages:
        ids.append(role_token(message["role"])); ids.extend(encode_text(message["content"]))
    ids.append(ASSISTANT)
    return ids


def generate(model, messages, max_new_tokens=160):
    ids = prompt_ids(messages); prompt_length = len(ids); context = model.context_size
    with torch.no_grad():
        for _ in range(max_new_tokens):
            inp = torch.tensor([ids[-context:]], dtype=torch.long)
            logits = model(inp)[0, -1].clone()
            for token in (BOS, USER, SYSTEM, ASSISTANT):
                logits[token] = -1e9
            next_token = int(torch.argmax(logits).item())
            if next_token == EOS:
                break
            ids.append(next_token)
    return bytes(token for token in ids[prompt_length:] if 0 <= token < 256).decode("utf-8", errors="ignore").strip()


def dataset_loss(model, path: Path, batch_size: int) -> tuple[float, int]:
    rows = load_rows(path)
    if not rows:
        raise SystemExit(f"evaluation dataset is empty: {path}")
    total_loss = 0.0; batches = 0
    with torch.no_grad():
        for start in range(0, len(rows), batch_size):
            x, y = make_batch(rows[start:start + batch_size], torch.device("cpu"), model.context_size)
            loss = F.cross_entropy(model(x).reshape(-1, 261), y.reshape(-1), ignore_index=-100)
            if not torch.isfinite(loss):
                raise SystemExit("evaluation produced a non-finite loss")
            total_loss += float(loss); batches += 1
    return total_loss / batches, len(rows)


def main():
    parser = argparse.ArgumentParser(description="Evaluate a BobAI native model with held-out loss and prompt smoke tests.")
    parser.add_argument("--model", type=Path, default=ROOT / "output/bob-0.2-native/model.bob")
    parser.add_argument("--test", type=Path, default=ROOT / "data/test.jsonl")
    parser.add_argument("--prompts", type=Path, default=ROOT / "eval/prompts.jsonl")
    parser.add_argument("--output", type=Path, default=ROOT / "output/evaluation.json")
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--max-new-tokens", type=int, default=160)
    parser.add_argument("--max-test-loss", type=float, default=None)
    parser.add_argument("--baseline-report", type=Path, default=None)
    parser.add_argument("--max-loss-regression", type=float, default=0.05)
    args = parser.parse_args()
    if not args.model.exists(): raise SystemExit("Train a native Bob model first or pass --model.")
    if args.batch_size < 1 or args.batch_size > 128: raise SystemExit("batch-size is outside the supported range")
    if args.max_new_tokens < 1 or args.max_new_tokens > 4096: raise SystemExit("max-new-tokens is outside the supported range")
    if args.max_loss_regression < 0 or args.max_loss_regression > 10: raise SystemExit("max-loss-regression is outside the supported range")

    model, header = load_native(args.model)
    test_loss, test_examples = dataset_loss(model, args.test, args.batch_size)
    prompts = [json.loads(line) for line in args.prompts.read_text(encoding="utf-8").splitlines() if line.strip()]
    results = []
    for prompt in prompts:
        response = generate(model, prompt["messages"], args.max_new_tokens)
        results.append({"id": prompt["id"], "response": response, "passed": bool(response)})
    passed = sum(1 for item in results if item["passed"])
    pass_rate = passed / len(results) if results else 0.0
    report = {
        "model_id": header.get("model_id", "bob-0.2-native"),
        "format": header.get("format"),
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "test_examples": test_examples,
        "test_loss": test_loss,
        "perplexity": math.exp(min(20.0, test_loss)),
        "prompt_passed": passed,
        "prompt_total": len(results),
        "prompt_pass_rate": pass_rate,
        "results": results,
    }
    if args.max_test_loss is not None and (test_loss > args.max_test_loss):
        report["gate_failed"] = "max-test-loss"
    if args.baseline_report:
        baseline = json.loads(args.baseline_report.read_text(encoding="utf-8"))
        baseline_loss = float(baseline["test_loss"]); baseline_rate = float(baseline["prompt_pass_rate"])
        if test_loss > baseline_loss * (1.0 + args.max_loss_regression) or pass_rate < baseline_rate:
            report["gate_failed"] = "regression"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    if "gate_failed" in report:
        raise SystemExit(f"evaluation gate failed: {report['gate_failed']}")


if __name__ == "__main__":
    main()
