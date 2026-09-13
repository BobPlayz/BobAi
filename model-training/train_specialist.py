from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset, Subset

from specialist_models import SPECIALISTS, loss_for, make_model

MAX_DATASET_BYTES = 512 * 1024 * 1024


class TensorDataset(Dataset):
    def __init__(self, payload, keys):
        self.payload = payload; self.keys = keys
        lengths = {int(v.shape[0]) for k, v in payload.items() if k in keys}
        if len(lengths) != 1: raise ValueError("all specialist tensors must have the same first dimension")
        self.length = next(iter(lengths))
        if self.length < 4: raise ValueError("specialist dataset must contain at least four examples")
        if "input_lengths" in payload and "target_lengths" in payload and torch.any(payload["target_lengths"] > payload["input_lengths"]): raise ValueError("ASR target length exceeds available input length")
        for key in keys:
            if not torch.isfinite(payload[key].float()).all(): raise ValueError(f"dataset tensor {key} contains non-finite values")

    def __len__(self): return self.length
    def __getitem__(self, index): return {key: self.payload[key][index] for key in self.keys}


def load_dataset(path, kind):
    if not path.exists(): raise SystemExit(f"dataset not found: {path}")
    if path.stat().st_size > MAX_DATASET_BYTES: raise SystemExit("specialist dataset exceeds the 512 MB safety limit")
    payload = torch.load(path, map_location="cpu", weights_only=True)
    if not isinstance(payload, dict) or not all(isinstance(k, str) and isinstance(v, torch.Tensor) for k, v in payload.items()): raise SystemExit("specialist dataset must be a torch-saved dictionary of tensors")
    required = {"embed":["ids_a","ids_b","label"],"reranker":["query","document","label"],"vision":["image","label"],"asr":["mel","targets","input_lengths","target_lengths"],"tts":["ids","mel"],"image":["ids","image"]}[kind]
    if kind == "embed" and "mask_a" in payload and "mask_b" in payload: required += ["mask_a","mask_b"]
    missing = [key for key in required if key not in payload]
    if missing: raise SystemExit(f"dataset is missing: {', '.join(missing)}")
    return TensorDataset(payload, required)


def collate(batch):
    result = {}
    for key in batch[0]:
        values = [item[key] for item in batch]; result[key] = torch.cat(values, dim=0) if key == "targets" else torch.stack(values)
    return result


def evaluate(kind, model, loader, device):
    model.eval(); losses = []
    with torch.no_grad():
        for batch in loader:
            batch = {key: value.to(device) for key, value in batch.items()}; loss = loss_for(kind, model, batch)
            if not torch.isfinite(loss): raise RuntimeError(f"non-finite {kind} validation loss encountered")
            losses.append(float(loss.cpu()))
    return sum(losses) / max(1, len(losses))


def train(kind, dataset_path, output, epochs, batch_size, learning_rate, seed, device_name, grad_accum=1, resume=None, validation_split=0.1, patience=0):
    if kind not in SPECIALISTS: raise SystemExit(f"unknown specialist: {kind}")
    if epochs < 1 or epochs > 100000 or batch_size < 1 or batch_size > 256 or grad_accum < 1 or grad_accum > 1024: raise SystemExit("training limits are invalid")
    if not 0.05 <= validation_split < 0.5: raise SystemExit("validation-split must be between 0.05 and 0.5")
    if patience < 0 or patience > 10000: raise SystemExit("patience is invalid")
    random.seed(seed); torch.manual_seed(seed)
    if device_name == "cuda" and not torch.cuda.is_available(): raise SystemExit("CUDA was requested but is unavailable")
    device = torch.device("cuda" if device_name == "cuda" or (device_name == "auto" and torch.cuda.is_available()) else "cpu")
    dataset = load_dataset(dataset_path, kind)
    indices = list(range(len(dataset))); random.Random(seed).shuffle(indices)
    validation_count = max(1, min(len(indices) - 1, round(len(indices) * validation_split)))
    train_set = Subset(dataset, indices[:-validation_count]); validation_set = Subset(dataset, indices[-validation_count:])
    train_loader = DataLoader(train_set, batch_size=batch_size, shuffle=True, collate_fn=collate)
    validation_loader = DataLoader(validation_set, batch_size=batch_size, shuffle=False, collate_fn=collate)
    model = make_model(kind).to(device); optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=0.01); scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, max(1, epochs))
    start = 0; best_val = float("inf"); stale = 0
    checkpoint_path = output.with_suffix(".checkpoint.pt"); best_path = output.with_suffix(".best.pt"); latest_path = output.with_suffix(".latest.pt")
    if resume:
        state = torch.load(Path(resume), map_location=device, weights_only=False)
        if state.get("specialist") != kind: raise SystemExit("checkpoint specialist does not match the requested kind")
        model.load_state_dict(state["model"]); optimizer.load_state_dict(state["optimizer"]); scheduler.load_state_dict(state["scheduler"]); start = int(state.get("epoch", 0)); best_val = float(state.get("best_validation_loss", float("inf"))); stale = int(state.get("stale", 0))
    for epoch in range(start, epochs):
        model.train(); losses = []; optimizer.zero_grad(set_to_none=True)
        for index, batch in enumerate(train_loader):
            batch = {key: value.to(device) for key, value in batch.items()}; loss = loss_for(kind, model, batch) / grad_accum
            if not torch.isfinite(loss): raise RuntimeError(f"non-finite {kind} loss encountered")
            loss.backward(); losses.append(float(loss.detach().cpu()))
            if (index + 1) % grad_accum == 0 or index + 1 == len(train_loader): nn.utils.clip_grad_norm_(model.parameters(), 1.0); optimizer.step(); optimizer.zero_grad(set_to_none=True)
        val_loss = evaluate(kind, model, validation_loader, device); scheduler.step(); improved = val_loss < best_val
        if improved:
            best_val = val_loss; stale = 0; torch.save({"epoch": epoch + 1, "model": model.state_dict(), "optimizer": optimizer.state_dict(), "scheduler": scheduler.state_dict(), "seed": seed, "specialist": kind, "best_validation_loss": best_val, "stale": stale}, best_path)
        else: stale += 1
        checkpoint = {"epoch": epoch + 1, "model": model.state_dict(), "optimizer": optimizer.state_dict(), "scheduler": scheduler.state_dict(), "seed": seed, "specialist": kind, "best_validation_loss": best_val, "stale": stale}
        torch.save(checkpoint, latest_path); torch.save(checkpoint, checkpoint_path)
        print(json.dumps({"specialist": kind, "epoch": epoch + 1, "train_loss": sum(losses) / max(1, len(losses)) * grad_accum, "validation_loss": val_loss, "best_validation_loss": best_val, "device": str(device), "best_checkpoint": str(best_path)}))
        if patience and stale >= patience: break
    if best_path.exists():
        best = torch.load(best_path, map_location=device, weights_only=False); model.load_state_dict(best["model"])
    output.parent.mkdir(parents=True, exist_ok=True); torch.save({"specialist": SPECIALISTS[kind].__dict__, "seed": seed, "state_dict": model.state_dict(), "best_validation_loss": best_val, "train_examples": len(train_set), "validation_examples": len(validation_set)}, output)
    print(json.dumps({"output": str(output), "parameters": sum(p.numel() for p in model.parameters()), "specialist": kind, "best_validation_loss": best_val, "best_checkpoint": str(best_path)}))


def main():
    parser = argparse.ArgumentParser(description="Train one BobAI specialist from scratch with a deterministic validation split and resumable best/latest checkpoints.")
    parser.add_argument("kind", choices=sorted(SPECIALISTS)); parser.add_argument("--dataset", type=Path, required=True); parser.add_argument("--output", type=Path, required=True); parser.add_argument("--epochs", type=int, default=20); parser.add_argument("--batch-size", type=int, default=8); parser.add_argument("--learning-rate", type=float, default=0.001); parser.add_argument("--seed", type=int, default=42); parser.add_argument("--device", choices=["auto", "cpu", "cuda"], default="auto"); parser.add_argument("--grad-accum", type=int, default=1); parser.add_argument("--resume", default=None); parser.add_argument("--validation-split", type=float, default=0.1); parser.add_argument("--patience", type=int, default=0)
    args = parser.parse_args(); train(**vars(args))


if __name__ == "__main__": main()
