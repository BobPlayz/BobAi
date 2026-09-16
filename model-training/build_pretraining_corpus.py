from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Iterable

try:
    from datasets import load_dataset
except ImportError as exc:
    raise SystemExit("install model-training/requirements.txt first") from exc

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "data" / "pretrain.jsonl"
DEFAULT_LANGUAGES = ["hin_Deva", "tel_Telu", "kan_Knda", "tam_Taml", "mal_Mlym", "mar_Deva", "ben_Beng", "urd_Arab", "spa_Latn", "fra_Latn", "deu_Latn", "por_Latn", "ita_Latn", "nld_Latn", "rus_Cyrl", "ukr_Cyrl", "pol_Latn", "tur_Latn", "pes_Arab", "ind_Latn", "vie_Latn", "tha_Thai", "zho_Hans", "jpn_Jpan", "kor_Hang", "arb_Arab", "swh_Latn"]
SECRET_PATTERNS = [re.compile(r"(?:sk|rk|ghp|xoxb|xoxp)-[A-Za-z0-9_-]{16,}"), re.compile(r"(?i)bearer\s+[A-Za-z0-9._-]{20,}"), re.compile(r"(?i)(password|passwd|api[_ -]?key|secret)\s*[:=]\s*\S+")]

def clean(text: object, minimum: int, maximum: int) -> str | None:
    if not isinstance(text, str): return None
    value = re.sub(r"\s+", " ", text).strip()
    if len(value) < minimum or len(value) > maximum: return None
    if any(pattern.search(value) for pattern in SECRET_PATTERNS): return None
    return value

def stream_dataset(name: str, config: str | None, split: str, limit: int) -> Iterable[dict]:
    kwargs = {"path": name, "split": split, "streaming": True}
    if config: kwargs["name"] = config
    dataset = load_dataset(**kwargs)
    for index, row in enumerate(dataset):
        if index >= limit: break
        yield row

def extract(row: dict) -> str | None:
    for key in ("text", "content", "completion", "response"):
        if key in row:
            return row[key] if isinstance(row[key], str) else None
    messages = row.get("messages")
    if isinstance(messages, list):
        parts = []
        for message in messages:
            if isinstance(message, dict) and isinstance(message.get("content"), str): parts.append(message["content"])
        return "\n".join(parts) if parts else None
    return None

def write_record(handle, text: str, source: str, config: str | None, seen: set[str]) -> bool:
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    if digest in seen: return False
    seen.add(digest)
    handle.write(json.dumps({"text": text, "source": source, "config": config, "sha256": digest, "license_boundary": "ODC-By/CommonCrawl upstream terms reviewed by operator"}, ensure_ascii=False) + "\n")
    return True

def main() -> None:
    parser = argparse.ArgumentParser(description="Stream eligible public knowledge corpora into a deterministic BobAI pretraining corpus.")
    parser.add_argument("--confirm-upstream-terms", action="store_true", help="confirm that you reviewed the selected upstream dataset and CommonCrawl/ODC-By terms")
    parser.add_argument("--english-limit", type=int, default=100_000)
    parser.add_argument("--per-language-limit", type=int, default=10_000)
    parser.add_argument("--languages", nargs="+", default=DEFAULT_LANGUAGES)
    parser.add_argument("--minimum-chars", type=int, default=200)
    parser.add_argument("--maximum-chars", type=int, default=50_000)
    parser.add_argument("--output", type=Path, default=OUT)
    args = parser.parse_args()
    if not args.confirm_upstream_terms: raise SystemExit("review the selected dataset cards and upstream terms, then pass --confirm-upstream-terms")
    if args.english_limit < 1 or args.per_language_limit < 1 or not 32 <= args.minimum_chars < args.maximum_chars <= 100_000: raise SystemExit("invalid corpus limits")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set(); counts: dict[str, int] = {}
    with args.output.open("w", encoding="utf-8") as handle:
        for source, config, limit in [("fineweb-edu", None, args.english_limit), *[("fineweb-2", language, args.per_language_limit) for language in args.languages]]:
            count = 0
            dataset_name = "HuggingFaceFW/fineweb-edu" if source == "fineweb-edu" else "HuggingFaceFW/fineweb-2"
            for row in stream_dataset(dataset_name, config, "train", limit):
                text = clean(extract(row), args.minimum_chars, args.maximum_chars)
                if text and write_record(handle, text, source, config, seen): count += 1
            counts[f"{source}:{config or 'default'}"] = count
    manifest = {"format": "bobai-pretrain-v1", "output": str(args.output), "records": sum(counts.values()), "unique_sha256": len(seen), "counts": counts, "sources": ["HuggingFaceFW/fineweb-edu", "HuggingFaceFW/fineweb-2"], "local_text": "explicitly eligible files may be added separately under model-training/data/pretraining-local", "private_chat_ingestion": False}
    args.output.with_suffix(".manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2, ensure_ascii=False))

if __name__ == "__main__": main()
