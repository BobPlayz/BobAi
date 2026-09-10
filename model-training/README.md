# Bob model training kit

This directory is the reproducible, provider-neutral starting point for Bob-0.1.

## What we are training

Bob-0.1 starts from `Qwen/Qwen2.5-0.5B-Instruct` and uses LoRA supervised fine-tuning. The base model is about 0.5B parameters and is Apache-2.0 licensed. The training code does **not** depend on Ollama or any specific inference server.

The base model is deliberately small so the first experiment can be attempted on a modest CPU/RAM machine. A later RTX 3050 machine can reuse the same dataset, format, evaluation, and model-gateway contract with a larger base model.

## Important privacy rule

Do not dump raw BobAI conversations into this directory. Training examples must be explicitly eligible for training and must pass sanitization. The starter dataset is synthetic and contains no personal conversation data.

The runtime policy in `apps/api/src/services/modelTrainingPolicy.ts` is fail-closed. This Python kit mirrors the same requirement at the dataset boundary: missing consent/eligibility is rejected.

## Folder layout

- `data/source.jsonl` - input examples in the safe training envelope format.
- `data/train.jsonl` - generated training split.
- `data/validation.jsonl` - generated validation split.
- `data/test.jsonl` - generated held-out split.
- `eval/prompts.jsonl` - fixed prompts for post-training checks.
- `config.json` - model/training defaults.
- `models.json` - model-version registry metadata.
- `prepare_dataset.py` - validates, sanitizes, deduplicates, and deterministically splits data.
- `train.py` - LoRA SFT training.
- `evaluate.py` - loads the adapter and runs the fixed evaluation prompts.

Generated weights and caches are intentionally ignored by git.

## Setup

Create a Python virtual environment and install:

```bash
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
# macOS/Linux
# source .venv/bin/activate

python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

## 1. Prepare the dataset

```bash
python model-training/prepare_dataset.py --input model-training/data/source.jsonl
```

This creates deterministic train/validation/test files and writes a manifest with counts and hashes.

## 2. Train Bob-0.1

```bash
python model-training/train.py
```

For a first laptop experiment, the default settings intentionally use a tiny context window, batch size 1, gradient accumulation, and LoRA. Training can still be slow on CPU and may require more RAM than the machine has available. If the machine cannot complete it, the dataset and pipeline remain ready for the RTX 3050 phase.

The output is a LoRA adapter, not a new standalone foundation model. That is expected.

## 3. Evaluate

```bash
python model-training/evaluate.py --adapter model-training/output/bob-0.1
```

The evaluator writes a JSON report. It is a smoke/evaluation harness, not a claim that a tiny adapter is smarter than the base model.

## 4. Connect a trained Bob model to BobAI

BobAI already separates the chat engine from the model provider. When an inference server exposes an OpenAI-compatible `/v1/chat/completions` endpoint, point the Bob model environment at it:

```text
BOBAI_MODEL_URL=https://your-model-endpoint
BOBAI_MODEL_KEY=...
BOBAI_MODEL_NAME=bob-0.1
```

The application does not need an Ollama-specific integration. A future Bob-1 model can replace Bob-0.1 by changing model deployment/configuration rather than rewriting chat, memory, tools, agents, or the UI.

## Scaling to the RTX 3050 phase

Keep the data format, evaluation prompts, model registry, and provider contract. Change only the base model/training configuration as hardware allows. Do not commit model weights into the BobAI source repository.
