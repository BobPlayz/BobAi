# BobAI native model training

BobAI owns its AI model boundary. Bob-0.2-native is a configurable decoder-only transformer trained from scratch and executed directly by the Node runtime through the portable `model.bob` format. It does not use Ollama, a hosted inference API, a pretrained foundation model, LoRA, or an external inference server.

The repository now also contains a from-scratch specialist training kit for capabilities that are fundamentally different from text generation. `specialist_models.py` defines small CPU-friendly research baselines for embeddings, reranking, vision encoding, speech recognition, speech synthesis, and text-conditioned image generation. `train_specialist.py` trains these models from local tensor datasets and writes self-contained PyTorch checkpoints with model metadata. These are deliberately small starting architectures for this laptop, not claims of parity with large production systems.

## Local setup

Create a Python environment and install the training dependency:

```bash
python -m venv .venv
# Windows PowerShell
.venv\\Scripts\\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r model-training/requirements.txt
```

Prepare the text dataset:

```bash
python model-training/prepare_dataset.py --input model-training/data/source.jsonl
```

Run a short text-model sanity training first:

```bash
python model-training/train.py --epochs 1 --batch-size 1 --device cpu
```

Then run the real text training when the eligible dataset and hardware are ready:

```bash
python model-training/train.py --epochs 40 --batch-size 4 --device cpu
```

The model writes `model-training/output/bob-0.2-native/model.bob` and `model.json`. Generated weights are ignored by git and must not be committed.

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

Examples:

```bash
python model-training/train_specialist.py embed --dataset data/embed.pt --output model-training/output/bob-embed-0.1.pt --epochs 20 --batch-size 8 --device cpu
python model-training/train_specialist.py reranker --dataset data/reranker.pt --output model-training/output/bob-reranker-0.1.pt --epochs 20 --batch-size 8 --device cpu
python model-training/train_specialist.py vision --dataset data/vision.pt --output model-training/output/bob-vision-0.1.pt --epochs 20 --batch-size 4 --device cpu
python model-training/train_specialist.py asr --dataset data/asr.pt --output model-training/output/bob-asr-0.1.pt --epochs 20 --batch-size 2 --device cpu
python model-training/train_specialist.py tts --dataset data/tts.pt --output model-training/output/bob-tts-0.1.pt --epochs 20 --batch-size 2 --device cpu
python model-training/train_specialist.py image --dataset data/image.pt --output model-training/output/bob-image-0.1.pt --epochs 20 --batch-size 4 --device cpu
```

The image generator is intentionally a 32x32 research baseline and is not a practical replacement for a modern diffusion model. The TTS baseline predicts mel features rather than directly producing a waveform, so a native vocoder is still required for audible speech. The ASR baseline expects log-mel features and uses CTC. These boundaries are explicit so training cannot be mistaken for a finished production speech or image stack.

## Data rules

Training data must be explicitly eligible. `prepare_dataset.py` rejects missing consent, sanitizes secrets and basic PII, validates roles, removes duplicates, and creates deterministic held-out splits. Never place raw private conversations, credentials, API keys, or other secrets in the repository. Conversation-derived training data must pass the same policy boundary used by the application.

## BobAI connection

BobAI reads the text model from `BOBAI_NATIVE_MODEL_DIR`, defaulting to `model-training/output/bob-0.2-native`. `BOBAI_MODEL_NAME` and `BOBAI_CODING_MODEL_NAME` select the native text model profile. If the model file is absent, readiness reports it as unavailable instead of silently falling back to another provider.

The specialist checkpoints are training artifacts today. The remaining integration boundary is a native runtime for each specialist format plus the data-preparation pipelines for real audio, image, and paired multimodal datasets. Codec work is separate: MP3, MP4, WebM, and similar formats require native codec implementations, not model training.

A tiny model trained on a tiny dataset is a development proof, not a frontier-quality assistant. Better capability requires substantially more eligible data, compute, evaluation, and iterative model versions. On an 8 GB CPU-first laptop, prioritize small models, checkpointing, validation, and measurable experiments rather than pretending a long training run guarantees quality.
