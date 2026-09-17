# BobAI production training

The production training flow is now designed to be started as one command on Windows and to survive relocation of the repository between drives.

For a repo copied to `D:\BobAi`, run:

```powershell
D:\BobAi\bob-training.cmd start
```

This performs the complete fresh pipeline: dependency install, multilingual knowledge-corpus preparation, deterministic pretraining split, instruction/capability dataset build, tokenizer training, pretraining, and instruction tuning. Paths are resolved relative to the repository, so moving BobAI from `C:` to a USB drive on `D:` does not require editing training scripts.

Controls:

```powershell
D:\BobAi\bob-training.cmd status
D:\BobAi\bob-training.cmd pause
D:\BobAi\bob-training.cmd resume
D:\BobAi\bob-training.cmd stop
```

Status includes stage, profile, step count, percentage, loss, validation loss when available, elapsed time, ETA, and checkpoint path. `latest.pt` is the resumable checkpoint. `best.pt` is the best validation checkpoint when available. Resume restores the saved stage/profile/settings from `training-pipeline.json`.

The bundled laptop default is `dev`. Larger profiles remain available through `model-training/pipeline.py`, but their memory and compute requirements are much higher. A fixed number of training days does not guarantee big-model quality.

The production model architecture is a separate scalable from-scratch Transformer with RoPE, RMSNorm, SwiGLU, grouped-query attention, SDPA/Flash Attention support where available, tied embeddings, gradient checkpointing, mixed precision, validation, resumable checkpoints, and torchrun/DDP support. The tokenizer is byte-level BPE trained across raw knowledge and instruction text.

The system's full user-facing capabilities are broader than the core model weights. Web research, files/RAG, coding sandboxes, computer control, Paint, Blender/3D, voice, image/video/audio/music providers, memory, APIs, databases, automations, and deployment remain runtime capabilities with permissions, safety boundaries, and result verification.

Repository code can make the training/serving flow reproducible and controllable. It cannot create extra GPU/RAM, supply external provider accounts, or guarantee a particular intelligence level from a fixed hardware/time budget.
