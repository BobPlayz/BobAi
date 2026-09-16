from __future__ import annotations

from dataclasses import asdict, dataclass
import math
from typing import Any

import torch
from torch import nn
import torch.nn.functional as F
import torch.utils.checkpoint as checkpoint


@dataclass
class ProductionConfig:
    vocab_size: int = 32768
    context_size: int = 4096
    d_model: int = 1024
    n_heads: int = 16
    n_kv_heads: int = 4
    n_layers: int = 24
    ffn_dim: int = 2816
    rope_theta: float = 10000.0
    dropout: float = 0.0
    tie_embeddings: bool = True
    gradient_checkpointing: bool = False

    def validate(self) -> None:
        if not 256 <= self.vocab_size <= 262144: raise ValueError("vocab_size out of range")
        if not 128 <= self.context_size <= 131072: raise ValueError("context_size out of range")
        if not 64 <= self.d_model <= 16384: raise ValueError("d_model out of range")
        if not 1 <= self.n_heads <= 256 or self.d_model % self.n_heads: raise ValueError("invalid n_heads")
        if not 1 <= self.n_kv_heads <= self.n_heads or self.n_heads % self.n_kv_heads: raise ValueError("invalid n_kv_heads")
        if not 1 <= self.n_layers <= 256: raise ValueError("n_layers out of range")
        if not self.d_model <= self.ffn_dim <= self.d_model * 8: raise ValueError("ffn_dim out of range")

    def to_dict(self) -> dict[str, Any]: return asdict(self)


class RMSNorm(nn.Module):
    def __init__(self, dim: int, eps: float = 1e-6): super().__init__(); self.weight = nn.Parameter(torch.ones(dim)); self.eps = eps
    def forward(self, x: torch.Tensor) -> torch.Tensor: return x * torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + self.eps) * self.weight


def rotate_half(x: torch.Tensor) -> torch.Tensor:
    x1 = x[..., ::2]; x2 = x[..., 1::2]
    return torch.stack((-x2, x1), dim=-1).flatten(-2)


def apply_rope(q: torch.Tensor, k: torch.Tensor, theta: float) -> tuple[torch.Tensor, torch.Tensor]:
    length, dim = q.size(-2), q.size(-1)
    inv_freq = 1.0 / (theta ** (torch.arange(0, dim, 2, device=q.device, dtype=torch.float32) / dim))
    angles = torch.outer(torch.arange(length, device=q.device, dtype=torch.float32), inv_freq)
    cos = torch.repeat_interleave(angles.cos(), 2, dim=-1).to(dtype=q.dtype)[None, None, :, :]
    sin = torch.repeat_interleave(angles.sin(), 2, dim=-1).to(dtype=q.dtype)[None, None, :, :]
    return q * cos + rotate_half(q) * sin, k * cos + rotate_half(k) * sin


class Attention(nn.Module):
    def __init__(self, config: ProductionConfig):
        super().__init__(); self.config = config; self.head_dim = config.d_model // config.n_heads
        self.q_proj = nn.Linear(config.d_model, config.n_heads * self.head_dim, bias=False); self.k_proj = nn.Linear(config.d_model, config.n_kv_heads * self.head_dim, bias=False); self.v_proj = nn.Linear(config.d_model, config.n_kv_heads * self.head_dim, bias=False); self.o_proj = nn.Linear(config.d_model, config.d_model, bias=False)
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        batch, length, _ = x.shape
        q = self.q_proj(x).view(batch, length, self.config.n_heads, self.head_dim).transpose(1, 2); k = self.k_proj(x).view(batch, length, self.config.n_kv_heads, self.head_dim).transpose(1, 2); v = self.v_proj(x).view(batch, length, self.config.n_kv_heads, self.head_dim).transpose(1, 2)
        q, k = apply_rope(q, k, self.config.rope_theta)
        if self.config.n_kv_heads != self.config.n_heads:
            repeats = self.config.n_heads // self.config.n_kv_heads; k = k.repeat_interleave(repeats, dim=1); v = v.repeat_interleave(repeats, dim=1)
        out = F.scaled_dot_product_attention(q, k, v, dropout_p=self.config.dropout if self.training else 0.0, is_causal=True)
        return self.o_proj(out.transpose(1, 2).contiguous().view(batch, length, self.config.d_model))


class SwiGLU(nn.Module):
    def __init__(self, config: ProductionConfig): super().__init__(); self.gate = nn.Linear(config.d_model, config.ffn_dim, bias=False); self.up = nn.Linear(config.d_model, config.ffn_dim, bias=False); self.down = nn.Linear(config.ffn_dim, config.d_model, bias=False)
    def forward(self, x: torch.Tensor) -> torch.Tensor: return self.down(F.silu(self.gate(x)) * self.up(x))


class Block(nn.Module):
    def __init__(self, config: ProductionConfig): super().__init__(); self.attn_norm = RMSNorm(config.d_model); self.ffn_norm = RMSNorm(config.d_model); self.attn = Attention(config); self.ffn = SwiGLU(config)
    def forward(self, x: torch.Tensor) -> torch.Tensor: x = x + self.attn(self.attn_norm(x)); return x + self.ffn(self.ffn_norm(x))


class BobProductionLM(nn.Module):
    def __init__(self, config: ProductionConfig):
        super().__init__(); config.validate(); self.config = config; self.embed = nn.Embedding(config.vocab_size, config.d_model); self.blocks = nn.ModuleList(Block(config) for _ in range(config.n_layers)); self.norm = RMSNorm(config.d_model); self.lm_head = nn.Linear(config.d_model, config.vocab_size, bias=False)
        self.apply(self._init_weights)
        if config.tie_embeddings: self.lm_head.weight = self.embed.weight
    def _init_weights(self, module: nn.Module) -> None:
        if isinstance(module, nn.Linear): nn.init.normal_(module.weight, mean=0.0, std=0.02 / math.sqrt(max(1, 2 * self.config.n_layers)))
        elif isinstance(module, nn.Embedding): nn.init.normal_(module.weight, mean=0.0, std=0.02)
    def forward(self, input_ids: torch.Tensor) -> torch.Tensor:
        if input_ids.size(1) > self.config.context_size: raise ValueError("sequence exceeds configured context")
        x = self.embed(input_ids)
        for block in self.blocks: x = checkpoint.checkpoint(block, x, use_reentrant=False) if self.config.gradient_checkpointing and self.training else block(x)
        return self.lm_head(self.norm(x))
    @torch.no_grad()
    def generate(self, input_ids: torch.Tensor, max_new_tokens: int = 256, temperature: float = 0.7, top_k: int = 50, eos_id: int | None = None) -> torch.Tensor:
        self.eval(); ids = input_ids
        for _ in range(max_new_tokens):
            logits = self(ids[:, -self.config.context_size:])[:, -1, :]
            if temperature <= 0: next_id = logits.argmax(-1, keepdim=True)
            else:
                logits = logits / max(temperature, 1e-5)
                if top_k > 0:
                    values, indices = torch.topk(logits, min(top_k, logits.size(-1))); probs = torch.softmax(values, dim=-1); next_id = indices.gather(-1, torch.multinomial(probs, 1))
                else: next_id = torch.multinomial(torch.softmax(logits, dim=-1), 1)
            ids = torch.cat([ids, next_id], dim=1)
            if eos_id is not None and bool((next_id == eos_id).all()): break
        return ids


def parameter_count(model: nn.Module) -> int: return sum(parameter.numel() for parameter in model.parameters())
