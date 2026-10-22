from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 4:
        print(json.dumps({"error": "expected model directory, audio file, and thread count"}))
        return 2
    model_path = Path(sys.argv[1]).resolve()
    audio_path = Path(sys.argv[2]).resolve()
    try:
        threads = max(1, min(8, int(sys.argv[3])))
    except ValueError:
        threads = 4
    if not model_path.is_dir() or not audio_path.is_file():
        print(json.dumps({"error": "local speech model or audio file is missing"}))
        return 3
    try:
        from faster_whisper import WhisperModel
        model = WhisperModel(str(model_path), device="cpu", compute_type="int8", cpu_threads=threads, num_workers=1, local_files_only=True)
        segments, info = model.transcribe(str(audio_path), beam_size=1, vad_filter=True, condition_on_previous_text=False)
        text = " ".join(segment.text.strip() for segment in segments if segment.text.strip()).strip()
        print(json.dumps({"text": text, "language": info.language, "languageProbability": info.language_probability}, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(json.dumps({"error": f"local transcription failed: {type(exc).__name__}: {exc}"}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
