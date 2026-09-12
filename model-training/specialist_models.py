from __future__ import annotations

from dataclasses import dataclass

import torch
from torch import Tensor, nn
import torch.nn.functional as F

VOCAB_SIZE = 261
ASR_CLASSES = VOCAB_SIZE + 1


class ByteTextEncoder(nn.Module):
    """Small trainable text encoder for embeddings and downstream specialists."""
    def __init__(self, dim: int = 128, layers: int = 2) -> None:
        super().__init__()
        self.embedding = nn.Embedding(VOCAB_SIZE, dim)
        self.layers = nn.ModuleList([nn.Sequential(nn.Linear(dim, dim * 2), nn.GELU(), nn.Linear(dim * 2, dim), nn.LayerNorm(dim)) for _ in range(layers)])
        self.projection = nn.Linear(dim, dim)

    def forward(self, ids: Tensor, mask: Tensor | None = None) -> Tensor:
        x = self.embedding(ids)
        if mask is None:
            mask = torch.ones(ids.shape[:2], device=ids.device, dtype=torch.bool)
        weights = mask.unsqueeze(-1).float()
        x = (x * weights).sum(1) / weights.sum(1).clamp_min(1.0)
        for layer in self.layers:
            x = x + layer(x)
        return F.normalize(self.projection(x), dim=-1)


class BobReranker(nn.Module):
    """Pairwise relevance scorer trained from query/document embedding pairs."""
    def __init__(self, dim: int = 128) -> None:
        super().__init__()
        self.net = nn.Sequential(nn.Linear(dim * 4, dim * 2), nn.GELU(), nn.Dropout(0.1), nn.Linear(dim * 2, 1))

    def forward(self, query: Tensor, document: Tensor) -> Tensor:
        features = torch.cat([query, document, query * document, torch.abs(query - document)], dim=-1)
        return self.net(features).squeeze(-1)


class BobVisionEncoder(nn.Module):
    """Tiny RGB patch encoder. Inputs are float tensors shaped [B,3,H,W]."""
    def __init__(self, dim: int = 128, patch: int = 8, layers: int = 2, heads: int = 4) -> None:
        super().__init__()
        if dim % heads:
            raise ValueError("vision dimension must be divisible by heads")
        self.patch = patch
        self.proj = nn.Conv2d(3, dim, patch, patch)
        self.cls = nn.Parameter(torch.zeros(1, 1, dim))
        self.attn = nn.TransformerEncoder(nn.TransformerEncoderLayer(dim, heads, dim * 4, batch_first=True, norm_first=True), layers)
        self.norm = nn.LayerNorm(dim)

    def forward(self, image: Tensor) -> Tensor:
        if image.ndim != 4 or image.shape[1] != 3:
            raise ValueError("vision input must be [batch,3,height,width]")
        if image.shape[2] % self.patch or image.shape[3] % self.patch:
            raise ValueError("vision height and width must be divisible by patch size")
        x = self.proj(image).flatten(2).transpose(1, 2)
        x = torch.cat([self.cls.expand(image.shape[0], -1, -1), x], dim=1)
        return F.normalize(self.norm(self.attn(x)[:, 0]), dim=-1)


class BobASR(nn.Module):
    """Small CPU-friendly CTC speech recognizer over log-mel features."""
    def __init__(self, n_mels: int = 80, hidden: int = 128, layers: int = 2) -> None:
        super().__init__()
        self.front = nn.Sequential(nn.Conv1d(n_mels, hidden, 5, stride=2, padding=2), nn.GELU(), nn.Conv1d(hidden, hidden, 5, stride=2, padding=2), nn.GELU())
        self.rnn = nn.GRU(hidden, hidden, layers, batch_first=True, bidirectional=True)
        self.head = nn.Linear(hidden * 2, ASR_CLASSES)

    def forward(self, mel: Tensor) -> Tensor:
        if mel.ndim != 3:
            raise ValueError("ASR input must be [batch,n_mels,time]")
        x = self.front(mel).transpose(1, 2)
        x, _ = self.rnn(x)
        return self.head(x).log_softmax(-1)


class BobTTS(nn.Module):
    """Small experimental text-to-mel synthesizer. It is intentionally a baseline, not a production voice clone."""
    def __init__(self, n_mels: int = 80, hidden: int = 128) -> None:
        super().__init__()
        self.embedding = nn.Embedding(VOCAB_SIZE, hidden)
        self.encoder = nn.GRU(hidden, hidden, 2, batch_first=True)
        self.decoder = nn.Sequential(nn.Conv1d(hidden, hidden, 5, padding=2), nn.GELU(), nn.Conv1d(hidden, n_mels, 5, padding=2))
        self.n_mels = n_mels

    def forward(self, ids: Tensor, output_frames: int | None = None) -> Tensor:
        x, _ = self.encoder(self.embedding(ids))
        x = x.transpose(1, 2)
        if output_frames is not None and output_frames != x.shape[-1]:
            x = F.interpolate(x, size=output_frames, mode="linear", align_corners=False)
        return self.decoder(x)


class BobTinyImage(nn.Module):
    """Very small text-conditioned 32x32 RGB generator for architecture experiments."""
    def __init__(self, latent: int = 128, size: int = 32) -> None:
        super().__init__()
        self.size = size
        self.text = ByteTextEncoder(latent, 1)
        self.net = nn.Sequential(nn.Linear(latent, latent * 4), nn.GELU(), nn.Linear(latent * 4, 3 * size * size), nn.Sigmoid())

    def forward(self, ids: Tensor, mask: Tensor | None = None) -> Tensor:
        return self.net(self.text(ids, mask)).view(ids.shape[0], 3, self.size, self.size)


@dataclass(frozen=True)
class SpecialistSpec:
    name: str
    task: str
    description: str
    dataset_format: str


SPECIALISTS = {
    "embed": SpecialistSpec("bob-embed-0.1", "embedding", "Trainable byte-text embedding encoder.", "torch file with ids [N,T] and optional mask [N,T]"),
    "reranker": SpecialistSpec("bob-reranker-0.1", "reranking", "Pairwise relevance scorer over embedding vectors.", "torch file with query [N,D], document [N,D], label [N]"),
    "vision": SpecialistSpec("bob-vision-0.1", "vision", "Small RGB patch transformer encoder.", "torch file with image [N,3,H,W], label [N,D]"),
    "asr": SpecialistSpec("bob-asr-0.1", "speech-recognition", "Small CTC speech recognizer over log-mel features.", "torch file with mel [N,M,T], targets shifted by +1, target_lengths, input_lengths"),
    "tts": SpecialistSpec("bob-tts-0.1", "speech-synthesis", "Experimental text-to-mel baseline.", "torch file with ids [N,T], mel [N,M,F]"),
    "image": SpecialistSpec("bob-image-0.1", "image-generation", "Tiny text-conditioned 32x32 generator for research only.", "torch file with ids [N,T] and image [N,3,32,32]"),
}


def make_model(kind: str) -> nn.Module:
    if kind == "embed": return ByteTextEncoder()
    if kind == "reranker": return BobReranker()
    if kind == "vision": return BobVisionEncoder()
    if kind == "asr": return BobASR()
    if kind == "tts": return BobTTS()
    if kind == "image": return BobTinyImage()
    raise ValueError(f"unknown specialist: {kind}")


def loss_for(kind: str, model: nn.Module, batch: dict[str, Tensor]) -> Tensor:
    if kind == "embed":
        left = model(batch["ids_a"], batch.get("mask_a"))
        right = model(batch["ids_b"], batch.get("mask_b"))
        labels = batch["label"].float()
        similarity = (left * right).sum(-1)
        return F.binary_cross_entropy_with_logits(similarity * 5.0, labels)
    if kind == "reranker":
        return F.binary_cross_entropy_with_logits(model(batch["query"], batch["document"]), batch["label"].float())
    if kind == "vision":
        prediction = model(batch["image"])
        return F.mse_loss(prediction, F.normalize(batch["label"], dim=-1))
    if kind == "asr":
        logits = model(batch["mel"]).transpose(0, 1)
        return F.ctc_loss(logits, batch["targets"].long(), batch["input_lengths"].long(), batch["target_lengths"].long(), blank=0, zero_infinity=True)
    if kind == "tts":
        prediction = model(batch["ids"], batch["mel"].shape[-1])
        return F.l1_loss(prediction, batch["mel"].float())
    if kind == "image":
        return F.mse_loss(model(batch["ids"]), batch["image"].float())
    raise ValueError(f"unknown specialist: {kind}")
