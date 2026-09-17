from __future__ import annotations

import argparse, json, os, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_DIR = ROOT / "output" / "bob-production"
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


def pretty_status(status: dict) -> str:
    if status.get("state") == "not_started":
        return "BobAI training has not started yet."
    parts = [f"state: {status.get('state', 'unknown')}"]
    if status.get("stage"): parts.append(f"stage: {status['stage']}")
    if status.get("profile"): parts.append(f"profile: {status['profile']}")
    step, total = status.get("step"), status.get("total_steps")
    if isinstance(step, int) and isinstance(total, int) and total > 0:
        parts.append(f"progress: {step}/{total} ({step / total * 100:.2f}%)")
    if isinstance(status.get("loss"), (int, float)): parts.append(f"loss: {status['loss']:.4f}")
    if isinstance(status.get("validation_loss"), (int, float)): parts.append(f"validation_loss: {status['validation_loss']:.4f}")
    if isinstance(status.get("elapsed_seconds"), (int, float)): parts.append(f"elapsed: {status['elapsed_seconds'] / 3600:.2f}h")
    if isinstance(status.get("eta_seconds"), (int, float)) and status["eta_seconds"] >= 0: parts.append(f"eta: {status['eta_seconds'] / 3600:.2f}h")
    if status.get("checkpoint"): parts.append(f"checkpoint: {status['checkpoint']}")
    return "\n".join(parts)


def main() -> None:
    parser = argparse.ArgumentParser(description="Control or inspect a resumable BobAI training run.")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_DIR)
    parser.add_argument("action", choices=["pause", "resume", "stop", "status", "json"])
    args = parser.parse_args()
    if args.action in {"status", "json"}:
        status = read_status(args.output_dir)
        print(json.dumps(status, indent=2) if args.action == "json" else pretty_status(status))
        return
    set_command(args.output_dir, args.action)
    if args.action == "resume":
        print("resume requested. If the training process already exited after pausing, run `npm run model:resume` from the BobAI folder.")
    else:
        print(f"training command set to {args.action}; the pipeline will acknowledge it at a checkpoint boundary")


if __name__ == "__main__":
    main()
