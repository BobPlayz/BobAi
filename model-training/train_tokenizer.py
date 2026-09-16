from __future__ import annotations

import argparse
import json
from pathlib import Path

from tokenizers import Tokenizer, decoders, models, normalizers, pre_tokenizers, processors, trainers

SPECIAL_TOKENS = ["<|pad|>", "<|bos|>", "<|eos|>", "<|system|>", "<|user|>", "<|assistant|>"]


def iter_text(path: Path):
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        messages = row.get("messages") if isinstance(row, dict) else None
        if not isinstance(messages, list):
            continue
        parts = []
        for message in messages:
            if not isinstance(message, dict):
                continue
            role = message.get("role")
            content = message.get("content")
            if role in {"system", "user", "assistant"} and isinstance(content, str) and content.strip():
                parts.append(f"<|{role}|>\n{content.strip()}")
        if parts:
            yield "<|bos|>\n" + "\n".join(parts) + "\n<|eos|>"


def main() -> None:
    parser = argparse.ArgumentParser(description="Train BobAI's production byte-level BPE tokenizer from the prepared training corpus.")
    parser.add_argument("--input", type=Path, default=Path("model-training/data/train.jsonl"))
    parser.add_argument("--output", type=Path, default=Path("model-training/output/bob-production/tokenizer.json"))
    parser.add_argument("--vocab-size", type=int, default=32768)
    parser.add_argument("--min-frequency", type=int, default=2)
    args = parser.parse_args()
    if not args.input.exists():
        raise SystemExit("training corpus is missing; run build_final_dataset.py and prepare_dataset.py first")
    if not 4096 <= args.vocab_size <= 262144:
        raise SystemExit("vocab size must be between 4096 and 262144")

    tokenizer = Tokenizer(models.BPE(unk_token=None, byte_fallback=True))
    tokenizer.normalizer = normalizers.Sequence([normalizers.NFC()])
    tokenizer.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)
    tokenizer.decoder = decoders.ByteLevel()
    trainer = trainers.BpeTrainer(vocab_size=args.vocab_size, min_frequency=args.min_frequency, special_tokens=SPECIAL_TOKENS, initial_alphabet=pre_tokenizers.ByteLevel.alphabet())
    tokenizer.train_from_iterator(iter_text(args.input), trainer=trainer)
    bos_id = tokenizer.token_to_id("<|bos|>"); eos_id = tokenizer.token_to_id("<|eos|>")
    if bos_id is None or eos_id is None:
        raise SystemExit("failed to create required special tokens")
    tokenizer.post_processor = processors.TemplateProcessing(single="<|bos|> $A <|eos|>", special_tokens=[("<|bos|>", bos_id), ("<|eos|>", eos_id)])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    tokenizer.save(str(args.output))
    metadata = {"format": "bobai-bpe", "vocab_size": tokenizer.get_vocab_size(), "special_tokens": {token: tokenizer.token_to_id(token) for token in SPECIAL_TOKENS}, "input": str(args.input)}
    args.output.with_suffix(".meta.json").write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(metadata, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
