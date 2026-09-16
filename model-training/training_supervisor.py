from __future__ import annotations

import argparse, json, os, signal, subprocess, sys, time
from pathlib import Path

CONTROL = "training-control.json"
STATUS = "training-status.json"
RUN = "training-run.json"
DEFAULT_DIR = Path("model-training/output/bob-production")


def atomic_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def read_json(path: Path, default: dict) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default
    except (OSError, json.JSONDecodeError):
        return default


def control(output: Path) -> dict:
    return read_json(output / CONTROL, {})


def set_control(output: Path, command: str) -> None:
    atomic_json(output / CONTROL, {"command": command, "updated_at": time.time()})


def show(output: Path) -> None:
    status = read_json(output / STATUS, {"state": "not_started"})
    print(json.dumps(status, indent=2))


def launch(args: argparse.Namespace, resume: bool = False) -> int:
    output = args.output_dir
    output.mkdir(parents=True, exist_ok=True)
    command = [sys.executable, str(Path(__file__).with_name("train_production.py")), "--stage", args.stage,
               "--train", str(args.train), "--validation", str(args.validation), "--tokenizer", str(args.tokenizer),
               "--output-dir", str(output), "--profile", args.profile, "--epochs", str(args.epochs),
               "--batch-size", str(args.batch_size), "--grad-accum", str(args.grad_accum), "--learning-rate", str(args.learning_rate),
               "--save-every", "1", "--eval-every", str(args.eval_every), "--eval-batches", str(args.eval_batches), "--precision", args.precision]
    if resume: command += ["--resume", str(output / "latest.pt")]
    if args.init_from: command += ["--init-from", str(args.init_from)]
    if args.max_steps: command += ["--max-steps", str(args.max_steps)]
    atomic_json(output / RUN, {"command": command, "started_at": time.time(), "pid": None})
    proc = subprocess.Popen(command)
    atomic_json(output / RUN, {"command": command, "started_at": time.time(), "pid": proc.pid})
    while proc.poll() is None:
        cmd = control(output).get("command")
        if cmd in {"pause", "stop"}:
            atomic_json(output / STATUS, {"state": "pausing" if cmd == "pause" else "stopping", "pid": proc.pid, "requested_at": time.time()})
            proc.terminate()
            try:
                proc.wait(timeout=15)
            except subprocess.TimeoutExpired:
                proc.kill(); proc.wait()
            state = "paused" if cmd == "pause" else "stopped"
            atomic_json(output / STATUS, {"state": state, "checkpoint": str(output / "latest.pt"), "ended_at": time.time()})
            set_control(output, "idle")
            return 0
        time.sleep(1)
    atomic_json(output / STATUS, {"state": "completed" if proc.returncode == 0 else "failed", "exit_code": proc.returncode, "ended_at": time.time()})
    return int(proc.returncode or 0)


def main() -> None:
    p = argparse.ArgumentParser(description="Run BobAI training as a separately controllable process.")
    sub = p.add_subparsers(dest="action", required=True)
    for name in ("start", "resume"):
        s = sub.add_parser(name)
        s.add_argument("--output-dir", type=Path, default=DEFAULT_DIR); s.add_argument("--stage", choices=["pretrain", "instruction"], default="pretrain")
        s.add_argument("--train", type=Path, required=True); s.add_argument("--validation", type=Path, required=True); s.add_argument("--tokenizer", type=Path, required=True)
        s.add_argument("--profile", choices=["dev", "125m", "350m", "1.3b", "3b"], default="dev"); s.add_argument("--epochs", type=int, default=1); s.add_argument("--batch-size", type=int, default=1); s.add_argument("--grad-accum", type=int, default=16)
        s.add_argument("--learning-rate", type=float, default=3e-4); s.add_argument("--precision", choices=["fp32", "fp16", "bf16"], default="fp32"); s.add_argument("--eval-every", type=int, default=500); s.add_argument("--eval-batches", type=int, default=20); s.add_argument("--max-steps", type=int, default=0); s.add_argument("--init-from", type=Path)
    s = sub.add_parser("status"); s.add_argument("--output-dir", type=Path, default=DEFAULT_DIR)
    for name in ("pause", "stop", "resume-request"):
        s = sub.add_parser(name); s.add_argument("--output-dir", type=Path, default=DEFAULT_DIR)
    args = p.parse_args()
    if args.action == "status": show(args.output_dir); return
    if args.action in {"pause", "stop", "resume-request"}:
        set_control(args.output_dir, "resume" if args.action == "resume-request" else args.action); print(f"training command requested: {args.action}"); return
    if args.action == "resume" and not (args.output_dir / "latest.pt").exists(): raise SystemExit("no latest.pt checkpoint exists; use start for a new run")
    raise SystemExit(launch(args, resume=args.action == "resume"))


if __name__ == "__main__": main()
