from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any

SECRET_PATTERNS = [
    re.compile(r"bearer\s+[a-z0-9._-]{20,}", re.I),
    re.compile(r"(?:api[_-]?key|secret|password|token|private[_-]?key)\s*[:=]\s*\S+", re.I),
    re.compile(r"-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----", re.I),
]
PII_PATTERNS = [
    re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I),
    re.compile(r"\b(?:\+?\d[\d ()-]{7,}\d)\b"),
]
ALLOWED_ROLES = {"system", "user", "assistant"}
MAX_MESSAGE_CHARS = 50_000
MAX_MESSAGES = 64


def sanitize(text: str) -> str:
    value = text
    for pattern in SECRET_PATTERNS:
        value = pattern.sub("[REDACTED]", value)
    for pattern in PII_PATTERNS:
        value = pattern.sub("[PRIVATE]", value)
    return value.strip()[:MAX_MESSAGE_CHARS]


def eligible(row: dict[str, Any]) -> bool:
    return (
        row.get("eligible_for_training") is True
        and row.get("consent_scope") in {"preferences-and-conversations", ""}
    )


def normalize(row: dict[str, Any]) -> dict[str, Any] | None:
    if not eligible(row):
        return None
    raw_messages = row.get("messages")
    if not isinstance(raw_messages, list) or not raw_messages or len(raw_messages) > MAX_MESSAGES:
        return None
    messages: list[dict[str, str]] = []
    for message in raw_messages:
        if not isinstance(message, dict):
            continue
        role = message.get("role")
        content = message.get("content")
        if role not in ALLOWED_ROLES or not isinstance(content, str):
            continue
        clean = sanitize(content)
        if clean:
            messages.append({"role": role, "content": clean})
    if not any(m["role"] == "user" for m in messages):
        return None
    if not any(m["role"] == "assistant" for m in messages):
        return None
    canonical = json.dumps(messages, ensure_ascii=False, separators=(",", ":"))
    return {"messages": messages, "fingerprint": hashlib.sha256(canonical.encode()).hexdigest()}


def split(rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    ordered = sorted(rows, key=lambda row: row["fingerprint"])
    if len(ordered) < 10:
        raise ValueError("At least 10 unique eligible examples are required for train/validation/test splits.")
    test_count = max(1, round(len(ordered) * 0.10))
    validation_count = max(1, round(len(ordered) * 0.10))
    if test_count + validation_count >= len(ordered):
        test_count = validation_count = 1
    train_end = len(ordered) - validation_count - test_count
    train = [{"messages": row["messages"]} for row in ordered[:train_end]]
    validation = [{"messages": row["messages"]} for row in ordered[train_end:train_end + validation_count]]
    test = [{"messages": row["messages"]} for row in ordered[train_end + validation_count:]]
    return train, validation, test


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare a safe Bob fine-tuning dataset.")
    parser.add_argument("--input", type=Path, default=Path("model-training/data/source.jsonl"))
    parser.add_argument("--output-dir", type=Path, default=Path("model-training/data"))
    args = parser.parse_args()

    accepted: list[dict[str, Any]] = []
    rejected = 0
    seen: set[str] = set()
    for line in args.input.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            row = json.loads(line)
            normalized = normalize(row)
        except (json.JSONDecodeError, TypeError):
            normalized = None
        if normalized is None or normalized["fingerprint"] in seen:
            rejected += 1
            continue
        seen.add(normalized["fingerprint"])
        accepted.append(normalized)

    try:
        train, validation, test = split(accepted)
    except ValueError as error:
        raise SystemExit(str(error)) from error

    write_jsonl(args.output_dir / "train.jsonl", train)
    write_jsonl(args.output_dir / "validation.jsonl", validation)
    write_jsonl(args.output_dir / "test.jsonl", test)

    manifest = {
        "schema_version": 1,
        "source": str(args.input),
        "accepted": len(accepted),
        "rejected_or_duplicate": rejected,
        "splits": {"train": len(train), "validation": len(validation), "test": len(test)},
        "policy": "explicit eligibility + consent scope + secret/PII sanitization + deterministic deduplication",
    }
    (args.output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
