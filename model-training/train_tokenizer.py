from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Iterable

from tokenizers import Tokenizer, decoders, models, normalizers, pre_tokenizers, processors, trainers

SPECIAL_TOKENS = ["<|pad|>", "<|bos|>", "<|eos|>", "<|system|>", "<|user|>", "<|assistant|>"]

def iter_text(paths: Iterable[Path]):
    for path in paths:
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                if not line.strip(): continue
                try: row = json.loads(line)
                except json.JSONDecodeError: continue
                if not isinstance(row, dict): continue
                if isinstance(row.get("text"), str) and row["text"].strip():
                    yield row["text"].strip(); continue
                messages = row.get("messages")
                if not isinstance(messages, list): continue
                parts = []
                for message in messages:
                    if isinstance(message, dict) and message.get("role") in {"system", "user", "assistant"} and isinstance(message.get("content"), str) and message["content"].strip():
                        parts.append(f"<|{message['role']}|>\n{message['content'].strip()}")
                if parts: yield "<|bos|>\n" + "\n".join(parts) + "\n<|eos|>"

def main() -> None:
    parser = argparse.ArgumentParser(description="Train BobAI's production byte-level BPE tokenizer over raw pretraining and instruction corpora.")
    parser.add_argument("--input", type=Path, nargs="+", default=[Path("model-training/data/train.jsonl")])
    parser.add_argument("--output", type=Path, default=Path("model-training/output/bob-production/tokenizer.json"))
    parser.add_argument("--vocab-size", type=int, default=32768)
    parser.add_argument("--min-frequency", type=int, default=2)
    args = parser.parse_args()
    missing = [str(path) for path in args.input if not path.exists()]
    if missing: raise SystemExit(f"training corpus is missing: {', '.join(missing)}")
    if not 4096 <= args.vocab_size <= 262144 or args.min_frequency < 1: raise SystemExit("invalid tokenizer settings")
    tokenizer = Tokenizer(models.BPE(unk_token=None, byte_fallback=True))
    tokenizer.normalizer = normalizers.Sequence([normalizers.NFC()])
    tokenizer.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)
    tokenizer.decoder = decoders.ByteLevel()
    trainer = trainers.BpeTrainer(vocab_size=args.vocab_size, min_frequency=args.min_frequency, special_tokens=SPECIAL_TOKENS, initial_alphabet=pre_tokenizers.ByteLevel.alphabet())
    tokenizer.train_from_iterator(iter_text(args.input), trainer=trainer)
    ids = {token: tokenizer.token_to_id(token) for token in SPECIAL_TOKENS}
    if ids["<|bos|>"] is None or ids["<|eos|>"] is None: raise SystemExit("required special tokens were not created")
    tokenizer.post_processor = processors.TemplateProcessing(single="<|bos|> $A <|eos|>", special_tokens=[("<|bos|>", ids["<|bos|>"]), ("<|eos|>", ids["<|eos|>"])])
    args.output.parent.mkdir(parents=True, exist_ok=True); tokenizer.save(str(args.output))
    metadata = {"format": "bobai-bpe", "vocab_size": tokenizer.get_vocab_size(), "special_tokens": ids, "inputs": [str(path) for path in args.input]}
    args.output.with_suffix(".meta.json").write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(metadata, indent=2, ensure_ascii=False))

if __name__ == "__main__": main()
