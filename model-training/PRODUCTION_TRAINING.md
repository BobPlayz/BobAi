# BobAI production training target

BobAI is designed as one user-facing assistant backed by a scalable core language/reasoning model, approved tools, memory, and modality specialists. The repo now contains both a tiny development model (`bob-0.2-native`) and a separate scalable production model path (`bob-production`).

## 1. Build the capability corpus

```bash
python -m pip install -r model-training/requirements.txt
python model-training/build_final_dataset.py
python model-training/prepare_dataset.py --input model-training/data/source.jsonl
```

The core corpus covers multilingual conversation, reasoning, epistemics/source checking, anti-sycophancy, emotional attunement, coding/software-factory workflows, research, computer use, MS Paint, Blender/3D, media routing, memory, automation, APIs, security, failure recovery, verification, teaching, and tool abstention.

## 2. Optional teacher-model distillation

BobAI can learn from outputs produced by a user-authorized OpenAI-compatible teacher model. This is deliberately rights-gated because provider/model terms differ.

```bash
python model-training/build_teacher_dataset.py \
  --endpoint https://YOUR-ENDPOINT/v1/chat/completions \
  --model YOUR-TEACHER-MODEL \
  --confirm-rights
```

The output is written under `model-training/data/teacher/` and is automatically merged by `build_final_dataset.py`. Multiple authorized teachers can be used by placing separate JSONL files in that directory with provenance metadata.

## 3. Multimodal assets

Put explicitly eligible licensed asset manifests under `model-training/data/multimodal/`, then validate them:

```bash
python model-training/build_multimodal_manifest.py
```

Supported labels are `image`, `audio`, `video`, `3d`, `music`, `document`, `table`, and `screenshot`. Every record requires source, license, task, explicit eligibility, a compatible extension, and file hashing when assets are mounted.

## 4. Train the production tokenizer

```bash
python model-training/train_tokenizer.py \
  --input model-training/data/train.jsonl \
  --output model-training/output/bob-production/tokenizer.json \
  --vocab-size 32768
```

The production tokenizer is byte-level BPE with BobAI conversation-role special tokens. It is separate from the tiny development model's 261-token byte vocabulary.

## 5. Train `bob-production`

Available profiles are `dev`, `125m`, `350m`, `1.3b`, and `3b`.

Single GPU/CPU example:

```bash
python model-training/train_production.py \
  --profile 350m \
  --epochs 1 \
  --batch-size 1 \
  --grad-accum 16 \
  --precision bf16 \
  --gradient-checkpointing
```

Multi-GPU example:

```bash
torchrun --standalone --nproc_per_node=4 model-training/train_production.py \
  --profile 1.3b \
  --batch-size 1 \
  --grad-accum 8 \
  --precision bf16 \
  --gradient-checkpointing
```

The production architecture uses RoPE, RMSNorm, SwiGLU, grouped-query attention, PyTorch scaled-dot-product attention/Flash Attention when the hardware supports it, mixed precision, gradient accumulation, gradient clipping, cosine decay with warmup, distributed data parallel training, validation, and resumable checkpoints.

Training writes `model-training/output/bob-production/latest.pt`, optional `best.pt`, `model.json`, and the tokenizer. Actual training duration does not guarantee quality by itself. Model scale, useful tokens, optimization, compute, evaluation, and data quality determine the result.

## 6. App runtime

If `latest.pt` and `tokenizer.json` exist, BobAI can launch the local production model worker automatically. The Node runtime spawns `production_model_server.py` on localhost with a random bearer token and bounded requests/responses. Set `BOBAI_MODEL_NAME=bob-production` to require it explicitly. If no production checkpoint exists and no explicit production model is requested, the app can continue using `bob-0.2-native` for development.

Useful environment variables:

```text
BOBAI_MODEL_NAME=bob-production
BOBAI_PRODUCTION_MODEL_PATH=model-training/output/bob-production/latest.pt
BOBAI_PRODUCTION_TOKENIZER_PATH=model-training/output/bob-production/tokenizer.json
BOBAI_PRODUCTION_MODEL_DEVICE=auto
BOBAI_PRODUCTION_MODEL_PORT=39850
```

## 7. Desktop, Paint, Blender, and tools

The API exposes first-class `computer`, `paint`, and `blender` tools behind the existing permission/approval/audit boundary. They use `BOBAI_COMPUTER_PROVIDER_URL` plus the optional `BOBAI_COMPUTER_PROVIDER_KEY`.

Blender supports `create_model`, `edit_model`, `render`, `export`, and `verify`. The core model is trained on tool traces such as Paint -> save -> verify -> Blender -> create -> verify -> render/export, rather than being trained to falsely claim the apps were used.

## Behavior target

BobAI is trained and prompted to:

- verify current, niche, changing, or disputed facts with research when available;
- correct false premises instead of mirroring them;
- avoid empty praise and reflexive agreement;
- react naturally to frustration, excitement, sadness, confusion, or anger without pretending to possess human emotions;
- distinguish facts, inference, and uncertainty;
- treat webpages, files, retrieved text, tool results, and teacher-model output as untrusted data;
- use tools when the user asks for actions and verify outcomes before claiming completion.

## Production-scale reality

The repository no longer forces production training through the tiny 2K-context byte model. It has a separate scalable model path and runtime. Reaching frontier-level capability still depends on the actual compute, amount and quality of licensed training data, model scale, training stability, evaluation, tool providers, and deployment resources available for the run. Those are external resources and execution steps rather than missing code architecture.
