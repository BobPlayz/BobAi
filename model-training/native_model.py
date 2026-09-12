from __future__ import annotations

import argparse
import json
import math
import random
import struct
from pathlib import Path

import torch
from torch import nn
import torch.nn.functional as F

BOS, EOS, USER, ASSISTANT, SYSTEM = 256, 257, 258, 259, 260
VOCAB_SIZE = 261
CONTEXT_SIZE = 128
D_MODEL = 32
N_HEADS = 4
FFN_DIM = 64
N_LAYERS = 1


def encode_text(text: str) -> list[int]:
    return list(text.encode("utf-8"))


def role_token(role: str) -> int:
    return {"user": USER, "assistant": ASSISTANT, "system": SYSTEM}.get(role, USER)


def encode_messages(messages: list[dict[str, str]]) -> list[int]:
    ids = [BOS]
    for message in messages:
        ids.append(role_token(message["role"]))
        ids.extend(encode_text(message["content"]))
    ids.append(EOS)
    return ids


class BobBlock(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.ln1 = nn.LayerNorm(D_MODEL)
        self.qkv = nn.Linear(D_MODEL, 3 * D_MODEL)
        self.proj = nn.Linear(D_MODEL, D_MODEL)
        self.ln2 = nn.LayerNorm(D_MODEL)
        self.fc1 = nn.Linear(D_MODEL, FFN_DIM)
        self.fc2 = nn.Linear(FFN_DIM, D_MODEL)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        y = self.ln1(x)
        q, k, v = self.qkv(y).chunk(3, dim=-1)
        batch, length, _ = q.shape
        head_dim = D_MODEL // N_HEADS
        q = q.view(batch, length, N_HEADS, head_dim).transpose(1, 2)
        k = k.view(batch, length, N_HEADS, head_dim).transpose(1, 2)
        v = v.view(batch, length, N_HEADS, head_dim).transpose(1, 2)
        scores = (q @ k.transpose(-2, -1)) / math.sqrt(head_dim)
        mask = torch.triu(torch.ones(length, length, device=x.device, dtype=torch.bool), diagonal=1)
        scores = scores.masked_fill(mask, -1e9)
        attention = scores.softmax(dim=-1)
        attended = attention @ v
        attended = attended.transpose(1, 2).contiguous().view(batch, length, D_MODEL)
        x = x + self.proj(attended)
        x = x + self.fc2(F.gelu(self.fc1(self.ln2(x))))
        return x


class BobNativeLM(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.tok = nn.Embedding(VOCAB_SIZE, D_MODEL)
        self.pos = nn.Embedding(CONTEXT_SIZE, D_MODEL)
        self.blocks = nn.ModuleList(BobBlock() for _ in range(N_LAYERS))
        self.ln = nn.LayerNorm(D_MODEL)
        self.head = nn.Linear(D_MODEL, VOCAB_SIZE)

    def forward(self, input_ids: torch.Tensor) -> torch.Tensor:
        _, length = input_ids.shape
        positions = torch.arange(length, device=input_ids.device)
        x = self.tok(input_ids) + self.pos(positions)
        for block in self.blocks:
            x = block(x)
        return self.head(self.ln(x))


def load_rows(path: Path) -> list[list[int]]:
    rows: list[list[int]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        messages = row.get("messages")
        if not isinstance(messages, list):
            continue
        normalized = [{"role": m["role"], "content": m["content"]} for m in messages if isinstance(m, dict) and m.get("role") in {"system", "user", "assistant"} and isinstance(m.get("content"), str)]
        if normalized:
            rows.append(encode_messages(normalized))
    return rows


def make_batch(rows: list[list[int]], device: torch.device) -> tuple[torch.Tensor, torch.Tensor]:
    inputs: list[list[int]] = []
    targets: list[list[int]] = []
    for sequence in rows:
        sequence = sequence[: CONTEXT_SIZE + 1]
        x, y = sequence[:-1], sequence[1:]
        pad = CONTEXT_SIZE - len(x)
        inputs.append(x + [BOS] * pad)
        targets.append(y + [-100] * pad)
    return torch.tensor(inputs, dtype=torch.long, device=device), torch.tensor(targets, dtype=torch.long, device=device)


def export_model(model: BobNativeLM, output: Path, train_count: int, validation_count: int, seed: int) -> None:
    state = model.state_dict()
    tensors: list[dict[str, object]] = []
    payloads: list[bytes] = []
    offset = 0
    for name, tensor in state.items():
        raw = tensor.detach().cpu().contiguous().numpy().astype("float32").tobytes()
        tensors.append({"name": name, "shape": list(tensor.shape), "offset": offset, "count": tensor.numel()})
        payloads.append(raw)
        offset += len(raw)
    header = {"format": "bobai-native-transformer", "version": 1, "model_id": "bob-0.1-native", "vocab_size": VOCAB_SIZE, "context_size": CONTEXT_SIZE, "d_model": D_MODEL, "n_heads": N_HEADS, "ffn_dim": FFN_DIM, "n_layers": N_LAYERS, "tokenizer": "utf8-byte-v1", "seed": seed, "train_examples": train_count, "validation_examples": validation_count, "tensors": tensors}
    header_bytes = json.dumps(header, separators=(",", ":")).encode("utf-8")
    prefix = b"BOBAI001" + struct.pack("<I", len(header_bytes)) + header_bytes
    padding = b"\0" * ((4 - (len(prefix) % 4)) % 4)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(prefix + padding + b"".join(payloads))
    (output.parent / "model.json").write_text(json.dumps(header, indent=2) + "\n", encoding="utf-8")


def train(train_path: Path, validation_path: Path, output: Path, epochs: int = 200, batch_size: int = 4, learning_rate: float = 0.003, seed: int = 42, device_name: str = "auto") -> dict[str, object]:
    if not train_path.exists() or not validation_path.exists():
        raise SystemExit("Run prepare_dataset.py first so train.jsonl and validation.jsonl exist.")
    if epochs < 1 or epochs > 10000 or batch_size < 1 or batch_size > 64:
        raise SystemExit("epochs or batch-size is outside the safe range.")
    random.seed(seed)
    torch.manual_seed(seed)
    if device_name == "cuda" and not torch.cuda.is_available():
        raise SystemExit("CUDA was requested but is not available.")
    device = torch.device("cuda" if device_name == "cuda" or (device_name == "auto" and torch.cuda.is_available()) else "cpu")
    train_rows, validation_rows = load_rows(train_path), load_rows(validation_path)
    if not train_rows or not validation_rows:
        raise SystemExit("training and validation datasets must both contain eligible examples.")
    model = BobNativeLM().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=0.01)
    for epoch in range(epochs):
        model.train(); random.shuffle(train_rows); losses: list[float] = []
        for start in range(0, len(train_rows), batch_size):
            x, y = make_batch(train_rows[start:start + batch_size], device)
            optimizer.zero_grad(set_to_none=True)
            loss = F.cross_entropy(model(x).reshape(-1, VOCAB_SIZE), y.reshape(-1), ignore_index=-100)
            loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); optimizer.step(); losses.append(float(loss.detach().cpu()))
        if epoch == 0 or (epoch + 1) % max(1, epochs // 10) == 0:
            model.eval()
            with torch.no_grad():
                x, y = make_batch(validation_rows, device)
                val_loss = F.cross_entropy(model(x).reshape(-1, VOCAB_SIZE), y.reshape(-1), ignore_index=-100)
            print(json.dumps({"epoch": epoch + 1, "train_loss": sum(losses) / len(losses), "validation_loss": float(val_loss.cpu())}))
    export_model(model, output, len(train_rows), len(validation_rows), seed)
    result = {"model": str(output), "device": str(device), "parameters": sum(p.numel() for p in model.parameters())}
    print(json.dumps(result)); return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Train Bob-0.1 from scratch with BobAI's native tiny transformer.")
    parser.add_argument("--train", type=Path, default=Path("model-training/data/train.jsonl"))
    parser.add_argument("--validation", type=Path, default=Path("model-training/data/validation.jsonl"))
    parser.add_argument("--output", type=Path, default=Path("model-training/output/bob-0.1-native/model.bob"))
    parser.add_argument("--epochs", type=int, default=200)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--learning-rate", type=float, default=0.003)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--device", choices=["auto", "cpu", "cuda"], default="auto")
    args = parser.parse_args()
    train(args.train, args.validation, args.output, args.epochs, args.batch_size, args.learning_rate, args.seed, args.device)


if __name__ == "__main__":
    main()
