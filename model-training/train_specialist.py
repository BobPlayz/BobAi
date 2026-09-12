from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset

from specialist_models import SPECIALISTS, loss_for, make_model


class TensorDataset(Dataset):
    def __init__(self, payload: dict[str, torch.Tensor], keys: list[str]) -> None:
        self.payload = payload
        self.keys = keys
        lengths = {int(value.shape[0]) for key, value in payload.items() if key in keys}
        if len(lengths) != 1:
            raise ValueError("all specialist tensors must have the same first dimension")
        self.length = next(iter(lengths))

    def __len__(self) -> int:
        return self.length

    def __getitem__(self, index: int) -> dict[str, torch.Tensor]:
        return {key: self.payload[key][index] for key in self.keys}


def load_dataset(path: Path, kind: str) -> TensorDataset:
    if not path.exists():
        raise SystemExit(f"dataset not found: {path}")
    payload = torch.load(path, map_location="cpu", weights_only=True)
    if not isinstance(payload, dict) or not all(isinstance(k, str) and isinstance(v, torch.Tensor) for k, v in payload.items()):
        raise SystemExit("specialist dataset must be a torch-saved dictionary of tensors")
    required = {
        "embed": ["ids_a", "ids_b", "label"],
        "reranker": ["query", "document", "label"],
        "vision": ["image", "label"],
        "asr": ["mel", "targets", "input_lengths", "target_lengths"],
        "tts": ["ids", "mel"],
        "image": ["ids", "image"],
    }[kind]
    missing = [key for key in required if key not in payload]
    if missing:
        raise SystemExit(f"dataset is missing: {', '.join(missing)}")
    return TensorDataset(payload, required)


def collate(batch: list[dict[str, torch.Tensor]]) -> dict[str, torch.Tensor]:
    result: dict[str, torch.Tensor] = {}
    for key in batch[0]:
        values = [item[key] for item in batch]
        if key == "targets":
            result[key] = torch.cat(values, dim=0)
        else:
            result[key] = torch.stack(values)
    return result


def train(kind: str, dataset_path: Path, output: Path, epochs: int, batch_size: int, learning_rate: float, seed: int, device_name: str) -> None:
    if kind not in SPECIALISTS:
        raise SystemExit(f"unknown specialist: {kind}")
    random.seed(seed)
    torch.manual_seed(seed)
    if device_name == "cuda" and not torch.cuda.is_available():
        raise SystemExit("CUDA was requested but is unavailable")
    device = torch.device("cuda" if device_name == "cuda" or (device_name == "auto" and torch.cuda.is_available()) else "cpu")
    dataset = load_dataset(dataset_path, kind)
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=True, collate_fn=collate)
    model = make_model(kind).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=0.01)
    model.train()
    for epoch in range(epochs):
        losses: list[float] = []
        for batch in loader:
            batch = {key: value.to(device) for key, value in batch.items()}
            optimizer.zero_grad(set_to_none=True)
            loss = loss_for(kind, model, batch)
            if not torch.isfinite(loss):
                raise RuntimeError(f"non-finite {kind} loss encountered")
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            losses.append(float(loss.detach().cpu()))
        print(json.dumps({"specialist": kind, "epoch": epoch + 1, "loss": sum(losses) / max(1, len(losses)), "device": str(device)}))
    output.parent.mkdir(parents=True, exist_ok=True)
    torch.save({"specialist": SPECIALISTS[kind].__dict__, "seed": seed, "state_dict": model.state_dict()}, output)
    print(json.dumps({"output": str(output), "parameters": sum(p.numel() for p in model.parameters()), "specialist": kind}))


def main() -> None:
    parser = argparse.ArgumentParser(description="Train one of BobAI's small from-scratch specialist models.")
    parser.add_argument("kind", choices=sorted(SPECIALISTS))
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--learning-rate", type=float, default=0.001)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--device", choices=["auto", "cpu", "cuda"], default="auto")
    args = parser.parse_args()
    if args.epochs < 1 or args.epochs > 10000 or args.batch_size < 1 or args.batch_size > 256:
        raise SystemExit("epochs or batch size is outside the safe range")
    train(args.kind, args.dataset, args.output, args.epochs, args.batch_size, args.learning_rate, args.seed, args.device)


if __name__ == "__main__":
    main()
