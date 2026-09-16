from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def split_file(source: Path, train: Path, validation: Path, validation_fraction: float) -> tuple[int, int]:
    train.parent.mkdir(parents=True, exist_ok=True)
    train_count = validation_count = 0
    with source.open("r", encoding="utf-8") as src, train.open("w", encoding="utf-8") as tr, validation.open("w", encoding="utf-8") as va:
        for line in src:
            if not line.strip(): continue
            try: row = json.loads(line)
            except json.JSONDecodeError: continue
            text = row.get("text") if isinstance(row, dict) else None
            if not isinstance(text, str) or not text.strip(): continue
            key = str(row.get("sha256") or hashlib.sha256(text.encode("utf-8")).hexdigest())
            bucket = int(key[:8], 16) / 0xFFFFFFFF
            target = va if bucket < validation_fraction else tr
            target.write(json.dumps(row, ensure_ascii=False) + "\n")
            if target is va: validation_count += 1
            else: train_count += 1
    return train_count, validation_count

def main() -> None:
    parser = argparse.ArgumentParser(description="Create deterministic train/validation splits for BobAI raw pretraining text.")
    parser.add_argument("--input", type=Path, default=ROOT / "data/pretrain.jsonl")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "data/pretrain")
    parser.add_argument("--validation-fraction", type=float, default=0.01)
    args = parser.parse_args()
    if not args.input.exists(): raise SystemExit("pretraining corpus is missing; run build_pretraining_corpus.py first")
    if not 0.001 <= args.validation_fraction <= 0.2: raise SystemExit("validation fraction must be between 0.001 and 0.2")
    train, validation = split_file(args.input, args.output_dir / "train.jsonl", args.output_dir / "validation.jsonl", args.validation_fraction)
    if train < 1 or validation < 1: raise SystemExit("pretraining split needs both train and validation records")
    manifest = {"format": "bobai-pretrain-split-v1", "input": str(args.input), "train": train, "validation": validation, "validation_fraction": args.validation_fraction}
    (args.output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))

if __name__ == "__main__": main()
