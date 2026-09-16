BobAI is now structured as one user-facing assistant with a central policy/tool boundary and a separate scalable production-model lane. The repository covers bounded tool execution, approvals, audit, cancellation, SSRF/network checks, provider limits, result validation, agent-plan budgets, memory/research/document/data/coding/browser/automation foundations, first-class computer/Paint/Blender boundaries, source checking, uncertainty, anti-sycophancy, emotional attunement without fake praise, failure recovery, licensed-data provenance, multimodal manifests, and rights-gated teacher distillation.

The production model path is separate from the tiny `bob-0.2-native` development model. `bob-production` uses a scalable from-scratch Transformer with RoPE, RMSNorm, SwiGLU, grouped-query attention, SDPA/Flash Attention where supported, tied embeddings, gradient checkpointing, mixed precision, gradient accumulation, validation, resumable checkpoints, and torchrun/DDP. The production tokenizer is byte-level BPE and can train over both raw knowledge text and instruction conversations. `build_pretraining_corpus.py` streams selected FineWeb-Edu English and FineWeb-2 multilingual configurations with deterministic hashing/deduplication and explicit upstream-terms confirmation. `prepare_pretraining.py` makes a deterministic held-out split. `train_production.py` has explicit pretraining and instruction stages, with `--init-from` weight transfer. `evaluate_production.py` evaluates held-out loss/perplexity and prompt smoke tests. `pipeline.py` orchestrates corpus preparation, tokenizer training, pretraining, and instruction tuning. `package.json` exposes production training/evaluation shortcuts.

Long-running training now has an operational control layer. `model-training/training_supervisor.py` launches the training child as a separately controllable process and forces a checkpoint after every optimizer step, so a pause/stop request can terminate the child without relying on Unix-only signals. `model-training/training_control.py` writes atomic control commands and reads persistent JSON status. `latest.pt` is the resume checkpoint; `best.pt` is the best validation checkpoint. The intended workflow is to pause training, use the latest completed checkpoint through the normal BobAI serving path, then resume from `latest.pt`. This separation is specifically intended to let a limited laptop release training resources before interactive chat.

Detailed operational commands are documented in `docs/TRAINING_RUNBOOK.md`. The core commands are:

```powershell
python -m pip install -r model-training\requirements.txt
python model-training\build_pretraining_corpus.py --confirm-upstream-terms
python model-training\prepare_pretraining.py
python model-training\build_final_dataset.py
python model-training\prepare_dataset.py --input model-training\data\source.jsonl
python model-training\train_tokenizer.py --input model-training\data\pretrain\train.jsonl model-training\data\train.jsonl --output model-training\output\bob-production\tokenizer.json
python model-training\training_supervisor.py start --stage pretrain --train model-training\data\pretrain\train.jsonl --validation model-training\data\pretrain\validation.jsonl --tokenizer model-training\output\bob-production\tokenizer.json --profile dev --epochs 1 --batch-size 1 --grad-accum 16 --precision fp32
python model-training\training_control.py status
python model-training\training_control.py pause
python model-training\training_supervisor.py resume --stage pretrain --train model-training\data\pretrain\train.jsonl --validation model-training\data\pretrain\validation.jsonl --tokenizer model-training\output\bob-production\tokenizer.json --profile dev --epochs 1 --batch-size 1 --grad-accum 16 --precision fp32
python model-training\training_control.py stop
python model-training\evaluate_production.py --checkpoint model-training\output\bob-production\best.pt --tokenizer model-training\output\bob-production\tokenizer.json
```

The `dev` profile is the practical local profile. Larger profiles require appropriate hardware. A 7–20 day runtime is not a guaranteed duration or quality target; actual training time depends on hardware, corpus size, profile, context length, batch size, and tokens processed. The training controls improve operational safety but cannot make insufficient hardware fast.

Training targets explicitly cover strong general conversation, reasoning, multilingual/code-switching behavior, source-backed research, coding and software-factory work, UI/UX design, files/RAG, computer use, Paint, Blender/3D, voice/turn-taking, image/video/audio/music, memory, APIs, databases, deployment, security, verification, recovery, and teaching. Runtime tools remain separate from weights because web search, file retrieval, computer control, Blender execution, and external media generation require permissions, providers, and result verification.

Repository-side architecture is complete for the requested production direction plus long-running training control. Remaining checklist items are execution dependencies: obtain/mount the licensed production and multimodal assets and permitted teacher outputs, provide sufficient compute/storage, actually train and evaluate the selected model, configure and verify real providers and BobHS workers, verify durable storage/backups, build native Windows media components, and run final concurrency/security/resilience testing for roughly 2,000 daily users. These cannot be completed truthfully by editing Git alone.

Future changes must inspect `main` first, keep the maintained branch policy, update `roadmap.md` and this handoff together in the same commit, and implement actionable repo-side fixes instead of merely reporting them.
