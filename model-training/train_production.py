from __future__ import annotations

import argparse
import json
import math
import os
import random
from pathlib import Path
from typing import Any

import torch
import torch.distributed as dist
from torch import nn
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.utils.data import DataLoader, Dataset, DistributedSampler
from tokenizers import Tokenizer

from production_model import BobProductionLM, ProductionConfig, parameter_count

PROFILES: dict[str, dict[str, int]] = {
    "dev": {"context_size": 512, "d_model": 256, "n_heads": 8, "n_kv_heads": 4, "n_layers": 8, "ffn_dim": 768},
    "125m": {"context_size": 2048, "d_model": 768, "n_heads": 12, "n_kv_heads": 4, "n_layers": 12, "ffn_dim": 2048},
    "350m": {"context_size": 4096, "d_model": 1024, "n_heads": 16, "n_kv_heads": 4, "n_layers": 24, "ffn_dim": 2816},
    "1.3b": {"context_size": 8192, "d_model": 2048, "n_heads": 32, "n_kv_heads": 8, "n_layers": 24, "ffn_dim": 5504},
    "3b": {"context_size": 8192, "d_model": 2560, "n_heads": 32, "n_kv_heads": 8, "n_layers": 32, "ffn_dim": 6912},
}
ROLE_TOKENS = {"system": "<|system|>", "user": "<|user|>", "assistant": "<|assistant|>"}


class JsonlConversationDataset(Dataset):
    def __init__(self, path: Path, tokenizer: Tokenizer, context_size: int):
        self.path = path; self.tokenizer = tokenizer; self.context_size = context_size; self.offsets: list[int] = []
        with path.open("rb") as handle:
            while True:
                offset = handle.tell(); line = handle.readline()
                if not line: break
                if line.strip(): self.offsets.append(offset)
        if not self.offsets: raise ValueError(f"no records found in {path}")
        self.pad_id = tokenizer.token_to_id("<|pad|>"); self.bos_id = tokenizer.token_to_id("<|bos|>"); self.eos_id = tokenizer.token_to_id("<|eos|>")
        if None in {self.pad_id, self.bos_id, self.eos_id}: raise ValueError("tokenizer is missing required special tokens")
    def __len__(self) -> int: return len(self.offsets)
    def _format(self, row: dict[str, Any]) -> str:
        parts = ["<|bos|>"]
        for message in row.get("messages", []):
            if not isinstance(message, dict): continue
            role, content = message.get("role"), message.get("content")
            if role in ROLE_TOKENS and isinstance(content, str) and content.strip(): parts.append(f"{ROLE_TOKENS[role]}\n{content.strip()}")
        parts.append("<|eos|>"); return "\n".join(parts)
    def __getitem__(self, index: int):
        with self.path.open("rb") as handle: handle.seek(self.offsets[index]); row = json.loads(handle.readline().decode("utf-8"))
        ids = self.tokenizer.encode(self._format(row), add_special_tokens=False).ids[: self.context_size + 1]
        if len(ids) < 2: ids = [int(self.bos_id), int(self.eos_id)]
        x, y = ids[:-1], ids[1:]; length = len(x); pad = self.context_size - length; x += [int(self.pad_id)] * pad; y += [-100] * pad
        return torch.tensor(x, dtype=torch.long), torch.tensor(y, dtype=torch.long), torch.tensor(length, dtype=torch.long)


def setup_distributed() -> tuple[int, int, int, bool]:
    world = int(os.environ.get("WORLD_SIZE", "1")); rank = int(os.environ.get("RANK", "0")); local_rank = int(os.environ.get("LOCAL_RANK", "0")); distributed = world > 1
    if distributed: dist.init_process_group(backend="nccl" if torch.cuda.is_available() else "gloo")
    return rank, local_rank, world, distributed

def cleanup_distributed(distributed: bool) -> None:
    if distributed and dist.is_initialized(): dist.destroy_process_group()
def unwrap(model: nn.Module) -> BobProductionLM: return model.module if isinstance(model, DDP) else model  # type: ignore[return-value]
def save_checkpoint(path: Path, model: nn.Module, optimizer: torch.optim.Optimizer, scheduler: torch.optim.lr_scheduler.LRScheduler, step: int, epoch: int, config: ProductionConfig, tokenizer_path: Path, best_val: float) -> None:
    path.parent.mkdir(parents=True, exist_ok=True); torch.save({"format": "bob-production-v1", "model": unwrap(model).state_dict(), "optimizer": optimizer.state_dict(), "scheduler": scheduler.state_dict(), "step": step, "epoch": epoch, "config": config.to_dict(), "tokenizer": str(tokenizer_path), "best_validation_loss": best_val}, path)
def evaluate(model: nn.Module, loader: DataLoader, device: torch.device, use_amp: bool, amp_dtype: torch.dtype, max_batches: int) -> float:
    model.eval(); losses = []
    with torch.no_grad():
        for index, (x, y, _) in enumerate(loader):
            if index >= max_batches: break
            x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
            with torch.autocast(device_type=device.type, dtype=amp_dtype, enabled=use_amp): logits = model(x); loss = nn.functional.cross_entropy(logits.reshape(-1, logits.size(-1)), y.reshape(-1), ignore_index=-100)
            losses.append(float(loss.detach().cpu()))
    model.train(); return sum(losses) / max(1, len(losses))


def main() -> None:
    parser = argparse.ArgumentParser(description="Train BobAI's scalable production Transformer from scratch. Supports torchrun/DDP, mixed precision, gradient accumulation, resumable checkpoints, RoPE, RMSNorm, SwiGLU, GQA, and SDPA/Flash Attention when available.")
    parser.add_argument("--train", type=Path, default=Path("model-training/data/train.jsonl")); parser.add_argument("--validation", type=Path, default=Path("model-training/data/validation.jsonl")); parser.add_argument("--tokenizer", type=Path, default=Path("model-training/output/bob-production/tokenizer.json")); parser.add_argument("--output-dir", type=Path, default=Path("model-training/output/bob-production")); parser.add_argument("--profile", choices=sorted(PROFILES), default="350m"); parser.add_argument("--epochs", type=int, default=1); parser.add_argument("--batch-size", type=int, default=1); parser.add_argument("--grad-accum", type=int, default=16); parser.add_argument("--learning-rate", type=float, default=3e-4); parser.add_argument("--weight-decay", type=float, default=0.1); parser.add_argument("--warmup-steps", type=int, default=100); parser.add_argument("--max-steps", type=int, default=0); parser.add_argument("--save-every", type=int, default=500); parser.add_argument("--eval-every", type=int, default=500); parser.add_argument("--eval-batches", type=int, default=50); parser.add_argument("--seed", type=int, default=42); parser.add_argument("--precision", choices=["fp32", "fp16", "bf16"], default="bf16"); parser.add_argument("--gradient-checkpointing", action="store_true"); parser.add_argument("--resume", type=Path); args = parser.parse_args()
    rank, local_rank, world, distributed = setup_distributed()
    try:
        random.seed(args.seed + rank); torch.manual_seed(args.seed + rank)
        if torch.cuda.is_available(): torch.cuda.set_device(local_rank); device = torch.device("cuda", local_rank)
        else: device = torch.device("cpu")
        tokenizer = Tokenizer.from_file(str(args.tokenizer)); config = ProductionConfig(vocab_size=tokenizer.get_vocab_size(), gradient_checkpointing=args.gradient_checkpointing, **PROFILES[args.profile]); config.validate()
        train_ds = JsonlConversationDataset(args.train, tokenizer, config.context_size); val_ds = JsonlConversationDataset(args.validation, tokenizer, config.context_size)
        train_sampler = DistributedSampler(train_ds, num_replicas=world, rank=rank, shuffle=True) if distributed else None; val_sampler = DistributedSampler(val_ds, num_replicas=world, rank=rank, shuffle=False) if distributed else None
        train_loader = DataLoader(train_ds, batch_size=args.batch_size, sampler=train_sampler, shuffle=train_sampler is None, num_workers=0, pin_memory=device.type == "cuda"); val_loader = DataLoader(val_ds, batch_size=args.batch_size, sampler=val_sampler, shuffle=False, num_workers=0, pin_memory=device.type == "cuda")
        model: nn.Module = BobProductionLM(config).to(device)
        if distributed: model = DDP(model, device_ids=[local_rank] if device.type == "cuda" else None, broadcast_buffers=False)
        optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate, betas=(0.9, 0.95), eps=1e-8, weight_decay=args.weight_decay)
        steps_per_epoch = max(1, math.ceil(len(train_loader) / args.grad_accum)); total_steps = args.max_steps or max(1, args.epochs * steps_per_epoch)
        def lr_lambda(step: int):
            if step < args.warmup_steps: return max(1e-8, step / max(1, args.warmup_steps))
            progress = min(1.0, (step - args.warmup_steps) / max(1, total_steps - args.warmup_steps)); return 0.1 + 0.9 * 0.5 * (1 + math.cos(math.pi * progress))
        scheduler = torch.optim.lr_scheduler.LambdaLR(optimizer, lr_lambda)
        use_amp = device.type == "cuda" and args.precision != "fp32"; amp_dtype = torch.bfloat16 if args.precision == "bf16" else torch.float16; scaler = torch.amp.GradScaler("cuda", enabled=use_amp and args.precision == "fp16")
        global_step = 0; start_epoch = 0; best_val = float("inf")
        if args.resume:
            state = torch.load(args.resume, map_location=device, weights_only=False); unwrap(model).load_state_dict(state["model"]); optimizer.load_state_dict(state["optimizer"]); scheduler.load_state_dict(state["scheduler"]); global_step = int(state.get("step", 0)); start_epoch = int(state.get("epoch", 0)); best_val = float(state.get("best_validation_loss", best_val))
        if rank == 0: print(json.dumps({"profile": args.profile, "parameters": parameter_count(unwrap(model)), "config": config.to_dict(), "device": str(device), "world_size": world, "total_steps": total_steps}))
        optimizer.zero_grad(set_to_none=True); stop = False
        for epoch in range(start_epoch, args.epochs):
            if train_sampler: train_sampler.set_epoch(epoch)
            for micro_step, (x, y, _) in enumerate(train_loader):
                x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True); sync_step = (micro_step + 1) % args.grad_accum == 0 or micro_step + 1 == len(train_loader); sync_context = model.no_sync() if isinstance(model, DDP) and not sync_step else torch.enable_grad()
                with sync_context:
                    with torch.autocast(device_type=device.type, dtype=amp_dtype, enabled=use_amp): logits = model(x); loss = nn.functional.cross_entropy(logits.reshape(-1, logits.size(-1)), y.reshape(-1), ignore_index=-100) / args.grad_accum
                    scaler.scale(loss).backward()
                if not sync_step: continue
                scaler.unscale_(optimizer); nn.utils.clip_grad_norm_(model.parameters(), 1.0); scaler.step(optimizer); scaler.update(); optimizer.zero_grad(set_to_none=True); scheduler.step(); global_step += 1
                if rank == 0 and (global_step == 1 or global_step % 20 == 0): print(json.dumps({"step": global_step, "epoch": epoch + 1, "loss": float(loss.detach().cpu()) * args.grad_accum, "lr": optimizer.param_groups[0]["lr"]}))
                if global_step % args.eval_every == 0:
                    val = evaluate(model, val_loader, device, use_amp, amp_dtype, args.eval_batches)
                    if distributed: t = torch.tensor([val], device=device); dist.all_reduce(t, op=dist.ReduceOp.SUM); val = float(t.item() / world)
                    if rank == 0:
                        improved = val < best_val; best_val = min(best_val, val); print(json.dumps({"step": global_step, "validation_loss": val, "best_validation_loss": best_val})); save_checkpoint(args.output_dir / "latest.pt", model, optimizer, scheduler, global_step, epoch, config, args.tokenizer, best_val)
                        if improved: save_checkpoint(args.output_dir / "best.pt", model, optimizer, scheduler, global_step, epoch, config, args.tokenizer, best_val)
                elif rank == 0 and global_step % args.save_every == 0: save_checkpoint(args.output_dir / "latest.pt", model, optimizer, scheduler, global_step, epoch, config, args.tokenizer, best_val)
                if global_step >= total_steps: stop = True; break
            if stop: break
        if rank == 0:
            save_checkpoint(args.output_dir / "latest.pt", model, optimizer, scheduler, global_step, args.epochs, config, args.tokenizer, best_val); (args.output_dir / "model.json").write_text(json.dumps({"model_id": "bob-production", "format": "bob-production-v1", "parameters": parameter_count(unwrap(model)), "config": config.to_dict(), "tokenizer": str(args.tokenizer), "best_validation_loss": best_val, "step": global_step}, indent=2) + "\n", encoding="utf-8")
    finally: cleanup_distributed(distributed)


if __name__ == "__main__": main()
