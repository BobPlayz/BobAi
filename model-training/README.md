# BobAI native model training

BobAI owns its AI model boundary. Bob-0.2-native is a configurable decoder-only transformer trained from scratch and executed directly by the Node runtime through the portable `model.bob` format. It does not use Ollama, a hosted inference API, a pretrained foundation model, LoRA, or an external inference server.

The repository contains a from-scratch specialist training kit for capabilities that are fundamentally different from text generation. `specialist_models.py` defines small CPU-friendly research baselines for embeddings, reranking, vision encoding, speech recognition, speech synthesis, and text-conditioned image generation. These are deliberately small starting architectures for this laptop, not claims of parity with large production systems.

## Final training corpus

`build_final_dataset.py` is the repository-owned capability-oriented corpus builder. It streams eligible Apache-2.0 public sources from Cohere Labs and OpenAssistant, records provenance, removes obvious secrets/basic PII, deduplicates deterministically, and adds a small original BobAI curriculum covering conversation, reasoning, coding, tool use, security, failure recovery, verification, memory, APIs, multilingual code-switching, and sandbox behavior.

The public source registry currently covers Aya Dataset, Aya Collection language splits, OpenAssistant/oasst1, and the Aya Evaluation Suite. The builder explicitly includes English, Hindi, Telugu, and a broader international language set. It does not ingest private ChatGPT conversation history.

Build it with:

```bash
python -m pip install -r model-training/requirements.txt
python model-training/build_final_dataset.py
python model-training/prepare_dataset.py --input model-training/data/source.jsonl
```

The builder writes generated `source.jsonl` and `source-manifest.json`; preparation writes deterministic train/validation/test splits and a manifest. Generated training data and weights are ignored by git and should not be committed.

The corpus is intentionally a language/agent behavior corpus. Voice, music, image, video, and speech generation still require modality-specific eligible datasets, model architectures, runtime adapters, and evaluation. Text data alone cannot create those generators. Likewise, a larger corpus cannot make the current tiny Transformer equivalent to a frontier model; model scale, architecture, compute, optimization, data quality, evaluation, and runtime tools all matter.

## Local setup

Create a Python environment and install the training dependencies:

```bash
python -m venv .venv
# Windows PowerShell
.venv\\Scripts\\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r model-training/requirements.txt
```

Run a short text-model sanity training first:

```bash
python model-training/train.py --epochs 1 --batch-size 1 --device cpu
```

Then run text training when the eligible dataset and hardware are ready:

```bash
python model-training/train.py --epochs 40 --batch-size 4 --device cpu
```

The model writes `model-training/output/bob-0.2-native/model.bob` and `model.json`.

Evaluate it with:

```bash
python model-training/evaluate.py --model model-training/output/bob-0.2-native/model.bob
```

## Specialist models

The specialist trainer accepts a PyTorch `.pt` dataset with the tensors described below. The tensors must already be locally prepared and must follow the same eligibility, consent, privacy, and licensing rules as the main Bob dataset.

```text
embed:    ids_a [N,T], ids_b [N,T], label [N]
reranker: query [N,D], document [N,D], label [N]
vision:   image [N,3,H,W], label [N,D]
asr:      mel [N,M,T], targets [N] per sample, input_lengths [N], target_lengths [N]
tts:      ids [N,T], mel [N,M,F]
image:    ids [N,T], image [N,3,32,32]
```

These remain research baselines. The image generator is 32x32, TTS predicts mel features and still needs a vocoder, and ASR expects log-mel features with CTC. Codec work is separate from model training.

## Data rules

Training data must be explicitly eligible. `prepare_dataset.py` accepts explicitly consented conversation data, approved public-dataset records, and original synthetic-curriculum records. It sanitizes secrets and basic PII, validates roles and message limits, removes duplicates, preserves non-sensitive provenance metadata, and creates deterministic held-out splits. Never place raw private conversations, credentials, API keys, or other secrets in the repository.

## BobAI connection

BobAI reads the text model from `BOBAI_NATIVE_MODEL_DIR`, defaulting to `model-training/output/bob-0.2-native`. `BOBAI_MODEL_NAME` and `BOBAI_CODING_MODEL_NAME` select the native text model profile. If the model file is absent, readiness reports it as unavailable instead of silently falling back to another provider.

The specialist checkpoints are training artifacts today. The remaining integration boundary is a native runtime for each specialist format plus real audio, image, paired multimodal, video, and music data/model pipelines. On an 8 GB CPU-first laptop, prioritize reproducible data builds, checkpointing, validation, and measurable experiments rather than pretending a long run guarantees quality.
