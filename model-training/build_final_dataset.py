from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any, Iterable

from datasets import load_dataset
from capability_curriculum import curriculum

LANGUAGES = ["eng", "hin", "tel", "kan", "tam", "mal", "mar", "ben", "urd", "pan", "arb", "ary", "fra", "deu", "spa", "por", "ita", "nld", "rus", "ukr", "pol", "tur", "fas", "ind", "vie", "tha", "zho", "jpn", "kor", "swh"]
SOURCES = {
    "aya_dataset": {"dataset": "CohereLabs/aya_dataset", "license": "Apache-2.0", "kind": "multilingual_instruction"},
    "aya_collection_language_split": {"dataset": "CohereLabs/aya_collection_language_split", "license": "Apache-2.0", "kind": "multilingual_task_mix"},
    "oasst1": {"dataset": "OpenAssistant/oasst1", "license": "Apache-2.0", "kind": "multilingual_conversation"},
    "aya_evaluation_suite": {"dataset": "CohereLabs/aya_evaluation_suite", "license": "Apache-2.0", "kind": "evaluation_style_instruction"},
    "bobai_original_curriculum": {"dataset": "BobAI original curriculum", "license": "original", "kind": "behavior_agent_tool_multimodal"},
    "teacher_distillation": {"dataset": "user-configured teacher output", "license": "source-dependent", "kind": "synthetic_teacher"},
}
SECRET_PATTERNS = [re.compile(r"bearer\s+[a-z0-9._-]{20,}", re.I), re.compile(r"(?:api[_-]?key|secret|password|token|private[_-]?key)\s*[:=]\s*\S+", re.I), re.compile(r"-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----", re.I)]
PII_PATTERNS = [re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I), re.compile(r"\b(?:\+?\d[\d ()-]{7,}\d)\b")]


def clean(text: Any, limit: int = 50_000) -> str:
    if not isinstance(text, str): return ""
    value = text
    for pattern in SECRET_PATTERNS: value = pattern.sub("[REDACTED]", value)
    for pattern in PII_PATTERNS: value = pattern.sub("[PRIVATE]", value)
    return value.strip()[:limit]


def fingerprint(messages: list[dict[str, str]]) -> str:
    return hashlib.sha256(json.dumps(messages, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).hexdigest()


def normalize_record(item: dict[str, Any]) -> dict[str, Any] | None:
    raw_messages = item.get("messages")
    if not isinstance(raw_messages, list): return None
    messages = []
    for message in raw_messages:
        if not isinstance(message, dict): continue
        role, content = message.get("role"), clean(message.get("content"))
        if role in {"system", "user", "assistant"} and content: messages.append({"role": role, "content": content})
    if not any(m["role"] == "user" for m in messages) or not any(m["role"] == "assistant" for m in messages): return None
    result = dict(item); result["messages"] = messages; result["fingerprint"] = fingerprint(messages)
    return result


def public_row(user: Any, assistant: Any, source: str, category: str, language: str | None = None) -> dict[str, Any] | None:
    item = {"eligible_for_training": True, "consent_scope": "public-dataset", "messages": [{"role": "user", "content": user or ""}, {"role": "assistant", "content": assistant or ""}], "metadata": {"source": source, "category": category, "license": SOURCES[source]["license"], "language": language, "synthetic": False}}
    return normalize_record(item)


def stream_aya(limit: int) -> Iterable[dict[str, Any]]:
    for item in load_dataset("CohereLabs/aya_dataset", split="train", streaming=True).take(limit):
        built = public_row(item.get("inputs"), item.get("targets"), "aya_dataset", "general_instruction", item.get("language_code") or item.get("language"))
        if built: yield built


def stream_aya_collection(languages: list[str], per_language: int) -> Iterable[dict[str, Any]]:
    for language in languages:
        try: ds = load_dataset("CohereLabs/aya_collection_language_split", language, split="train", streaming=True)
        except Exception as exc:
            print(json.dumps({"warning": "aya_collection_language_unavailable", "language": language, "error": str(exc)})); continue
        count = 0
        for item in ds:
            built = public_row(item.get("inputs"), item.get("targets"), "aya_collection_language_split", "multilingual_task_mix", language)
            if built: yield built; count += 1
            if count >= per_language: break


def stream_aya_eval(limit: int) -> Iterable[dict[str, Any]]:
    for config in ("aya_human_annotated", "dolly_human_edited"):
        try: ds = load_dataset("CohereLabs/aya_evaluation_suite", config, split="test", streaming=True)
        except Exception as exc:
            print(json.dumps({"warning": "aya_eval_unavailable", "config": config, "error": str(exc)})); continue
        count = 0
        for item in ds:
            built = public_row(item.get("inputs"), item.get("targets"), "aya_evaluation_suite", "evaluation_style_instruction", item.get("language"))
            if built: yield built; count += 1
            if count >= limit: break


def stream_oasst(limit: int) -> Iterable[dict[str, Any]]:
    ds = load_dataset("OpenAssistant/oasst1", split="train", streaming=True); messages: dict[str, dict[str, Any]] = {}; count = 0
    for item in ds:
        message_id = item.get("message_id")
        if not message_id: continue
        messages[str(message_id)] = item
        if item.get("role") != "assistant" or not isinstance(item.get("text"), str): continue
        chain: list[dict[str, str]] = []; cursor = item; seen: set[str] = set()
        while cursor and len(chain) < 32:
            current_id = str(cursor.get("message_id") or "")
            if current_id in seen: break
            seen.add(current_id); current_role = cursor.get("role"); current_text = cursor.get("text")
            if current_role in {"prompter", "assistant"} and isinstance(current_text, str): chain.append({"role": "user" if current_role == "prompter" else "assistant", "content": current_text})
            parent_id = cursor.get("parent_id"); cursor = messages.get(str(parent_id)) if parent_id else None
        chain.reverse()
        built = normalize_record({"eligible_for_training": True, "consent_scope": "public-dataset", "messages": chain, "metadata": {"source": "oasst1", "category": "conversation", "license": "Apache-2.0", "language": item.get("lang"), "synthetic": False}})
        if built: yield built; count += 1
        if count >= limit: break


def stream_curriculum() -> Iterable[dict[str, Any]]:
    for item in curriculum():
        built = normalize_record(item)
        if built: yield built


def stream_local_jsonl(directory: Path, source: str) -> Iterable[dict[str, Any]]:
    if not directory.exists(): return
    for path in sorted(directory.glob("*.jsonl")):
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip(): continue
            try: item = json.loads(line)
            except json.JSONDecodeError: continue
            if not isinstance(item, dict) or item.get("eligible_for_training") is not True: continue
            metadata = item.get("metadata") if isinstance(item.get("metadata"), dict) else {}
            metadata["source"] = source; item["metadata"] = metadata
            built = normalize_record(item)
            if built: yield built


def write_jsonl(path: Path, rows: Iterable[dict[str, Any]]) -> tuple[int, Counter[str], Counter[str]]:
    path.parent.mkdir(parents=True, exist_ok=True); seen: set[str] = set(); categories: Counter[str] = Counter(); capabilities: Counter[str] = Counter(); written = 0
    with path.open("w", encoding="utf-8") as handle:
        for item in rows:
            fp = item["fingerprint"]
            if fp in seen: continue
            seen.add(fp); handle.write(json.dumps(item, ensure_ascii=False) + "\n"); written += 1
            metadata = item.get("metadata", {}); categories[str(metadata.get("category", "uncategorized"))] += 1; capabilities[str(metadata.get("capability", metadata.get("category", "general")))] += 1
    return written, categories, capabilities


def main() -> None:
    parser = argparse.ArgumentParser(description="Build BobAI's capability-oriented corpus: multilingual conversation, epistemics, emotional attunement, agents/tools, coding, computer use, Paint, Blender/3D, media routing, security, recovery, and optional teacher distillation.")
    parser.add_argument("--output", type=Path, default=Path("model-training/data/source.jsonl")); parser.add_argument("--aya", type=int, default=100_000); parser.add_argument("--oasst", type=int, default=40_000); parser.add_argument("--aya-collection-per-language", type=int, default=250); parser.add_argument("--aya-eval", type=int, default=2_000); parser.add_argument("--languages", nargs="*", default=LANGUAGES); parser.add_argument("--teacher-dir", type=Path, default=Path("model-training/data/teacher")); args = parser.parse_args()
    def records() -> Iterable[dict[str, Any]]:
        yield from stream_aya(args.aya); yield from stream_oasst(args.oasst); yield from stream_aya_collection(args.languages, args.aya_collection_per_language); yield from stream_aya_eval(args.aya_eval); yield from stream_curriculum(); yield from stream_local_jsonl(args.teacher_dir, "teacher_distillation")
    count, categories, capabilities = write_jsonl(args.output, records())
    manifest = {"schema_version": 3, "builder": "model-training/build_final_dataset.py", "records": count, "categories": dict(sorted(categories.items())), "capabilities": dict(sorted(capabilities.items())), "sources": SOURCES, "languages_requested": args.languages, "limits": {"aya": args.aya, "oasst": args.oasst, "aya_collection_per_language": args.aya_collection_per_language, "aya_evaluation_suite": args.aya_eval}, "privacy": "Private ChatGPT history is not automatically ingested. Public, original, and explicitly eligible teacher data are sanitized and deduplicated.", "scope": "conversation, multilingual, epistemics/source checking, anti-glazing/disagreement, emotional attunement, reasoning, coding/software factory, research, agents/tools, computer use, MS Paint, Blender/3D, media routing, voice/image/video/music, documents, data analysis, memory, teaching, security, sandboxing, recovery, verification, APIs, automation, and tool abstention", "modality_boundary": "Binary image/audio/video/3D/music assets are trained through modality-specific manifests/specialists or executed through authorized tools; the core corpus teaches orchestration and reasoning across them."}
    args.output.with_name("source-manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"); print(json.dumps(manifest, indent=2, ensure_ascii=False))

if __name__ == "__main__": main()
