from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

SECRET_PATTERNS = [
    re.compile(r"bearer\s+[a-z0-9._-]{20,}", re.I),
    re.compile(r"(?:api[_-]?key|secret|password|token|private[_-]?key)\s*[:=]\s*\S+", re.I),
    re.compile(r"-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----", re.I),
]
PII_PATTERNS = [
    re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I),
    re.compile(r"\b(?:\+?\d[\d ()-]{7,}\d)\b"),
]
ROLES = {"system", "user", "assistant"}
CONSENT_SCOPE = "preferences-and-conversations"
MAX_MESSAGE_CHARS = 50_000
MAX_MESSAGES = 64

def sanitize(text: str) -> str:
    for pattern in SECRET_PATTERNS:
        text = pattern.sub("[REDACTED]", text)
    for pattern in PII_PATTERNS:
        text = pattern.sub("[PRIVATE]", text)
    return text.strip()[:MAX_MESSAGE_CHARS]

def normalize(row: dict) -> dict | None:
    if row.get("eligible_for_training") is not True:
        return None
    if row.get("consent_scope") != CONSENT_SCOPE:
        return None
    raw = row.get("messages")
    if not isinstance(raw, list) or not raw or len(raw) > MAX_MESSAGES:
        return None

    messages = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        role, content = item.get("role"), item.get("content")
        if role not in ROLES or not isinstance(content, str):
            continue
        content = sanitize(content)
        if content:
            messages.append({"role": role, "content": content})

    if not any(m["role"] == "user" for m in messages):
        return None
    if not any(m["role"] == "assistant" for m in messages):
        return None

    canonical = json.dumps(messages, ensure_ascii=False, separators=(",", ":"))
    return {
        "messages": messages,
        "fingerprint": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
    }

def iter_jsonl(path: Path):
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue

def main():
    parser = argparse.ArgumentParser(description="Build a large sharded BobAI training corpus.")
    parser.add_argument("--source-dir", type=Path, default=Path("model-training/data/sources"))
    parser.add_argument("--output-dir", type=Path, default=Path("model-training/data/large"))
    parser.add_argument("--overflow-dir", type=Path, default=None)
    parser.add_argument("--max-gb", type=float, default=5.5)
    parser.add_argument("--shard-mb", type=float, default=256)
    parser.add_argument("--reserve-gb", type=float, default=1.0)
    args = parser.parse_args()

    if args.max_gb <= 0 or args.shard_mb <= 1:
        raise SystemExit("Invalid storage limits.")

    sources = sorted(
        p for p in args.source_dir.rglob("*")
        if p.is_file() and p.suffix.lower() in {".jsonl", ".ndjson"}
    )
    if not sources:
        raise SystemExit(f"No JSONL/NDJSON sources found in {args.source_dir}.")

    requested = int(args.max_gb * 1_000_000_000)
    shard_limit = int(args.shard_mb * 1_000_000)
    reserve = int(args.reserve_gb * 1_000_000_000)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    usage = shutil.disk_usage(args.output_dir)
    local_capacity = max(0, usage.free - reserve)

    if local_capacity < 100_000_000 and args.overflow_dir:
        args.overflow_dir.mkdir(parents=True, exist_ok=True)
        output_root = args.overflow_dir
        usage = shutil.disk_usage(output_root)
        capacity = max(0, usage.free - reserve)
    else:
        output_root = args.output_dir
        capacity = local_capacity

    limit = min(requested, capacity)
    if limit < 100_000_000:
        raise SystemExit("Not enough safe free disk space.")

    seen = set()
    accepted = rejected = duplicates = 0
    bytes_written = 0
    shard_index = 0
    shard = None

    def open_shard(index):
        path = output_root / f"train-{index:05d}.jsonl"
        return path, path.open("a", encoding="utf-8")

    try:
        _, shard = open_shard(shard_index)

        stop = False
        for source in sources:
            for row in iter_jsonl(source):
                normalized = normalize(row)
                if normalized is None:
                    rejected += 1
                    continue

                fp = normalized["fingerprint"]
                if fp in seen:
                    duplicates += 1
                    continue
                seen.add(fp)

                encoded = (
                    json.dumps(
                        {"messages": normalized["messages"]},
                        ensure_ascii=False,
                        separators=(",", ":"),
                    ) + "\n"
                ).encode("utf-8")

                if bytes_written + len(encoded) > limit:
                    stop = True
                    break

                if shard.tell() + len(encoded) > shard_limit:
                    shard.close()
                    shard_index += 1
                    _, shard = open_shard(shard_index)

                shard.write(encoded.decode("utf-8"))
                bytes_written += len(encoded)
                accepted += 1

            if stop:
                break
    finally:
        if shard is not None:
            shard.close()

    manifest = {
        "schema_version": 2,
        "format": "bobai-chat-jsonl-sharded",
        "accepted": accepted,
        "rejected": rejected,
        "duplicates": duplicates,
        "bytes_written": bytes_written,
        "gigabytes_written": round(bytes_written / 1_000_000_000, 3),
        "shards": shard_index + 1 if accepted else 0,
        "max_gigabytes": args.max_gb,
        "shard_megabytes": args.shard_mb,
        "output": str(output_root),
        "policy": {
            "consent_required": True,
            "consent_scope": CONSENT_SCOPE,
            "secret_redaction": True,
            "basic_pii_redaction": True,
            "sha256_deduplication": True,
        },
        "sources": [str(p) for p in sources],
    }

    (output_root / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(manifest, indent=2))

if __name__ == "__main__":
    main()
