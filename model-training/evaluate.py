from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

ROOT = Path(__file__).resolve().parent


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def generate(model, tokenizer, messages: list[dict], max_new_tokens: int = 120) -> str:
    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(text, return_tensors="pt").to(model.device)
    with torch.no_grad():
        outputs = model.generate(**inputs, max_new_tokens=max_new_tokens, do_sample=False)
    generated = outputs[0][inputs["input_ids"].shape[-1]:]
    return tokenizer.decode(generated, skip_special_tokens=True).strip()


def run_checks(text: str, checks: list[str]) -> dict[str, bool]:
    lower = text.lower()
    results = {"non_empty": bool(text.strip())}
    if "mentions_software_interface" in checks:
        results["mentions_software_interface"] = any(word in lower for word in ("program", "software", "interface", "request", "api"))
    if "mentions_model_gateway" in checks:
        results["mentions_model_gateway"] = any(word in lower for word in ("gateway", "model", "provider", "replace", "swap"))
    if "mentions_consent" in checks:
        results["mentions_consent"] = any(word in lower for word in ("consent", "permission", "opt-in", "eligible", "training"))
    if "mentions_adapter" in checks:
        results["mentions_adapter"] = any(word in lower for word in ("adapter", "small", "parameters", "weights", "lora"))
    if "mentions_verification" in checks:
        results["mentions_verification"] = any(word in lower for word in ("verify", "check", "source", "current", "uncertain"))
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Run deterministic smoke evaluation for a Bob adapter.")
    parser.add_argument("--adapter", type=Path, required=True)
    parser.add_argument("--base-model", default=None)
    parser.add_argument("--output", type=Path, default=ROOT / "output" / "evaluation.json")
    args = parser.parse_args()

    metadata_path = args.adapter / "bob-model.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8")) if metadata_path.exists() else {}
    base_model = args.base_model or metadata.get("base_model")
    if not base_model:
        raise SystemExit("Base model is required. Pass --base-model or train.py metadata must exist.")

    tokenizer = AutoTokenizer.from_pretrained(args.adapter)
    base = AutoModelForCausalLM.from_pretrained(base_model, torch_dtype="auto")
    model = PeftModel.from_pretrained(base, str(args.adapter))
    model.eval()

    prompts = load_jsonl(ROOT / "eval" / "prompts.jsonl")
    results = []
    for prompt in prompts:
        response = generate(model, tokenizer, prompt["messages"])
        checks = run_checks(response, prompt.get("checks", []))
        results.append({"id": prompt["id"], "response": response, "checks": checks, "passed": all(checks.values())})

    passed = sum(1 for result in results if result["passed"])
    report = {
        "model_id": metadata.get("model_id", args.adapter.name),
        "base_model": base_model,
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "passed": passed,
        "total": len(results),
        "pass_rate": passed / len(results) if results else 0.0,
        "results": results,
        "note": "This is a deterministic smoke/evaluation harness, not a benchmark against frontier models.",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
