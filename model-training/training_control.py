from __future__ import annotations

import argparse, json, os, time
from pathlib import Path

DEFAULT_DIR = Path("model-training/output/bob-production")
CONTROL = "training-control.json"
STATUS = "training-status.json"


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def set_command(directory: Path, command: str) -> None:
    write_json(directory / CONTROL, {"command": command, "updated_at": time.time()})


def read_status(directory: Path) -> dict:
    path = directory / STATUS
    if not path.exists():
        return {"state": "not_started", "message": "no training status has been written yet"}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"state": "unknown", "message": "status file is unavailable or being replaced"}


def main() -> None:
    parser = argparse.ArgumentParser(description="Control or inspect a resumable BobAI training run.")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_DIR)
    parser.add_argument("action", choices=["pause", "resume", "stop", "status", "clear-stop"])
    args = parser.parse_args()
    if args.action == "status":
        print(json.dumps(read_status(args.output_dir), indent=2))
        return
    set_command(args.output_dir, "resume" if args.action == "clear-stop" else args.action)
    print(f"training command set to {args.action}; the trainer will checkpoint and acknowledge it safely")


if __name__ == "__main__":
    main()
