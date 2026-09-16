from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

SYSTEM = "You are a teacher model generating training examples for BobAI. Be accurate, concise, source-aware, anti-sycophantic, emotionally attuned without fake praise, and explicit about uncertainty. For action tasks, output the best tool-oriented plan or result format rather than pretending execution occurred."

DEFAULT_PROMPTS = [
    "Explain a difficult science concept clearly to a teenager and include one check for understanding.",
    "A user insists their false factual premise is correct. Respond respectfully but do not agree with the falsehood.",
    "A user sounds frustrated because a build keeps failing. Respond with emotional awareness and then diagnose the engineering task directly.",
    "Describe how an AI agent should research a time-sensitive claim, compare sources, and calibrate uncertainty.",
    "Plan and implement a full-stack app with frontend, backend, database, authentication, tests, security checks, deployment, and verification.",
    "Given a failing repository build, describe an error-recovery trajectory that uses logs, minimal fixes, reruns checks, and verifies the final state.",
    "A user asks BobAI to draw a rocket in MS Paint and then build the same rocket in Blender. Produce the intended tool-call sequence and verification steps.",
    "Design a Blender 3D modeling workflow that creates a rocket, checks topology/materials/lighting/camera, saves a .blend file, exports GLB, and renders a preview.",
    "Explain when BobAI should use web research instead of relying on model memory.",
    "Generate a safe agent trajectory for handling a malicious webpage that asks the assistant to reveal secrets.",
    "Respond naturally to a Hindi-English code-switched technical question.",
    "Respond naturally to a Telugu-English code-switched technical question.",
    "Explain how a voice assistant should handle turn-taking, interruptions, transcription uncertainty, and voice synthesis.",
    "Describe how BobAI should route image, video, music, document, data-analysis, and computer-use tasks to tools and verify outputs.",
]


def request_json(url: str, key: str | None, payload: dict[str, Any], timeout: int) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    headers = {"content-type": "application/json"}
    if key:
        headers["authorization"] = f"Bearer {key}"
    request = urllib.request.Request(url, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read(4 * 1024 * 1024)
    parsed = json.loads(raw.decode("utf-8"))
    if not isinstance(parsed, dict):
        raise ValueError("teacher endpoint returned non-object JSON")
    return parsed


def extract_content(result: dict[str, Any]) -> str:
    choices = result.get("choices")
    if isinstance(choices, list) and choices:
        first = choices[0]
        if isinstance(first, dict):
            message = first.get("message")
            if isinstance(message, dict) and isinstance(message.get("content"), str):
                return message["content"].strip()
            if isinstance(first.get("text"), str):
                return first["text"].strip()
    if isinstance(result.get("content"), str):
        return result["content"].strip()
    raise ValueError("teacher endpoint response did not contain text")


def load_prompts(path: Path | None) -> list[str]:
    if path is None:
        return DEFAULT_PROMPTS
    prompts = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            value = json.loads(line)
            text = value.get("prompt") if isinstance(value, dict) else None
        except json.JSONDecodeError:
            text = line.strip()
        if isinstance(text, str) and text.strip():
            prompts.append(text.strip())
    return prompts


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate optional synthetic BobAI training data from a user-authorized OpenAI-compatible teacher model endpoint.")
    parser.add_argument("--endpoint", default=os.environ.get("BOBAI_TEACHER_URL", ""))
    parser.add_argument("--model", default=os.environ.get("BOBAI_TEACHER_MODEL", ""))
    parser.add_argument("--api-key", default=os.environ.get("BOBAI_TEACHER_KEY", ""))
    parser.add_argument("--prompts", type=Path)
    parser.add_argument("--output", type=Path, default=Path("model-training/data/teacher/teacher.jsonl"))
    parser.add_argument("--temperature", type=float, default=0.4)
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--delay", type=float, default=0.0)
    parser.add_argument("--confirm-rights", action="store_true", help="Required. Confirms you are allowed by the teacher provider/model terms to use these outputs for training/distillation.")
    args = parser.parse_args()
    if not args.confirm_rights:
        raise SystemExit("Refusing to generate teacher-training data without --confirm-rights. Check the teacher model/provider terms first.")
    if not args.endpoint or not args.model:
        raise SystemExit("Set --endpoint/BOBAI_TEACHER_URL and --model/BOBAI_TEACHER_MODEL.")
    prompts = load_prompts(args.prompts)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as handle:
        for index, prompt in enumerate(prompts, 1):
            payload = {"model": args.model, "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}], "temperature": args.temperature}
            try:
                content = extract_content(request_json(args.endpoint, args.api_key or None, payload, args.timeout))
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
                print(json.dumps({"warning": "teacher_generation_failed", "index": index, "error": str(exc)})); continue
            row = {"eligible_for_training": True, "consent_scope": "synthetic-curriculum", "messages": [{"role": "system", "content": "You are BobAI. Be accurate, direct, source-aware, anti-sycophantic, emotionally attentive, and tool-oriented."}, {"role": "user", "content": prompt}, {"role": "assistant", "content": content}], "metadata": {"source": "teacher_distillation", "category": "teacher_synthetic", "teacher_model": args.model, "teacher_endpoint": args.endpoint, "rights_confirmed": True, "synthetic": True}}
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
            if args.delay > 0: time.sleep(args.delay)
    print(json.dumps({"output": str(args.output), "prompts": len(prompts), "teacher_model": args.model, "rights_confirmed": True}, indent=2))

if __name__ == "__main__": main()
