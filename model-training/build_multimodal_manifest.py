from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

MODALITIES = {"image", "audio", "video", "3d", "music", "document", "table", "screenshot"}
ALLOWED_ASSET_EXTENSIONS = {
    "image": {".png", ".jpg", ".jpeg", ".webp"},
    "audio": {".wav", ".flac", ".mp3", ".ogg", ".m4a"},
    "music": {".wav", ".flac", ".mp3", ".ogg", ".m4a", ".mid", ".midi"},
    "video": {".mp4", ".webm", ".mov", ".mkv"},
    "3d": {".blend", ".glb", ".gltf", ".obj", ".fbx", ".stl"},
    "document": {".pdf", ".txt", ".md", ".docx", ".pptx"},
    "table": {".csv", ".tsv", ".json", ".parquet", ".xlsx"},
    "screenshot": {".png", ".jpg", ".jpeg", ".webp"},
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            block = handle.read(1024 * 1024)
            if not block: break
            digest.update(block)
    return digest.hexdigest()


def validate_record(raw: dict[str, Any], base: Path, require_files: bool) -> tuple[dict[str, Any] | None, str | None]:
    modality = raw.get("modality")
    asset = raw.get("asset")
    source = raw.get("source")
    license_name = raw.get("license")
    task = raw.get("task")
    if modality not in MODALITIES: return None, "unsupported modality"
    if not isinstance(asset, str) or not asset.strip(): return None, "missing asset"
    if not isinstance(source, str) or not source.strip(): return None, "missing source"
    if not isinstance(license_name, str) or not license_name.strip(): return None, "missing license"
    if not isinstance(task, str) or not task.strip(): return None, "missing task"
    path = (base / asset).resolve()
    if path.suffix.lower() not in ALLOWED_ASSET_EXTENSIONS[modality]: return None, "asset extension does not match modality"
    if require_files and not path.is_file(): return None, "asset file missing"
    output = {
        "id": str(raw.get("id") or hashlib.sha256(f"{modality}:{asset}:{task}".encode()).hexdigest()[:24]),
        "modality": modality,
        "asset": asset,
        "task": task.strip(),
        "source": source.strip(),
        "license": license_name.strip(),
        "eligible_for_training": raw.get("eligible_for_training") is True,
        "metadata": raw.get("metadata") if isinstance(raw.get("metadata"), dict) else {},
    }
    if require_files:
        output["sha256"] = sha256(path); output["bytes"] = path.stat().st_size
    if not output["eligible_for_training"]: return None, "record not explicitly eligible"
    return output, None


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate and merge licensed BobAI multimodal asset manifests for vision, speech, live voice, music, video, documents, tables, screenshots, and Blender/3D training/evaluation.")
    parser.add_argument("--input-dir", type=Path, default=Path("model-training/data/multimodal"))
    parser.add_argument("--output", type=Path, default=Path("model-training/data/multimodal-manifest.jsonl"))
    parser.add_argument("--allow-missing-files", action="store_true", help="Useful when building a remote/portable manifest before assets are mounted.")
    args = parser.parse_args()
    accepted, rejected = 0, 0; by_modality: dict[str, int] = {}; errors: list[dict[str, str]] = []; seen: set[str] = set(); args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as out:
        for manifest in sorted(args.input_dir.rglob("*.jsonl")) if args.input_dir.exists() else []:
            for line_number, line in enumerate(manifest.read_text(encoding="utf-8").splitlines(), 1):
                if not line.strip(): continue
                try: raw = json.loads(line)
                except json.JSONDecodeError:
                    rejected += 1; errors.append({"file": str(manifest), "line": str(line_number), "error": "invalid json"}); continue
                if not isinstance(raw, dict):
                    rejected += 1; continue
                record, error = validate_record(raw, args.input_dir, not args.allow_missing_files)
                if error or record is None:
                    rejected += 1; errors.append({"file": str(manifest), "line": str(line_number), "error": error or "invalid record"}); continue
                key = str(record.get("sha256") or f"{record['modality']}:{record['asset']}:{record['task']}")
                if key in seen: continue
                seen.add(key); out.write(json.dumps(record, ensure_ascii=False) + "\n"); accepted += 1; by_modality[record["modality"]] = by_modality.get(record["modality"], 0) + 1
    summary = {"schema_version": 1, "accepted": accepted, "rejected": rejected, "by_modality": dict(sorted(by_modality.items())), "output": str(args.output), "errors": errors[:100], "rule": "Every asset needs explicit training eligibility, source, license, modality, task, extension validation, deduplication, and file hashing when mounted."}
    args.output.with_suffix(".summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2, ensure_ascii=False))

if __name__ == "__main__": main()
