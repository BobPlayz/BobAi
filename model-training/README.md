# BobAI native model training

BobAI now owns the model architecture and inference runtime. Bob-0.1-native is a small decoder-only transformer trained from scratch on the sanitized BobAI dataset format. It does not use Ollama, a hosted inference API, a pretrained foundation model, LoRA, or an external inference server.

The native architecture is intentionally small so it can be trained as a first local model on modest hardware. It uses a UTF-8 byte tokenizer with five control tokens, one transformer block, 32 hidden dimensions, four attention heads, a 64-unit feed-forward layer, and a 128-token context window. The Node.js runtime in `apps/api/src/services/nativeModel.ts` executes the same architecture directly from a portable `model.bob` file, so normal BobAI chat does not spawn another AI process.

Training data must remain explicitly eligible. `prepare_dataset.py` rejects missing consent, sanitizes secrets and basic PII, validates roles, removes duplicates, and creates deterministic train/validation/test splits. Never place raw private conversations in the repository. Conversation-derived training data must pass the same policy boundary used by the application.

## Setup

Create a Python environment and install the only training dependency:

```bash
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r model-training/requirements.txt
```

Prepare the dataset:

```bash
python model-training/prepare_dataset.py --input model-training/data/source.jsonl
```

Train Bob from scratch:

```bash
python model-training/train.py
```

The command writes `model-training/output/bob-0.1-native/model.bob` and `model.json`. Generated model artifacts are ignored by git because model weights do not belong in the source repository.

Useful overrides are available for local hardware:

```bash
python model-training/train.py --epochs 50 --batch-size 1 --device cpu
python model-training/train.py --epochs 200 --device cuda
```

Evaluate the generated native model:

```bash
python model-training/evaluate.py --model model-training/output/bob-0.1-native/model.bob
```

## Connecting the model

BobAI reads the native model from `BOBAI_NATIVE_MODEL_DIR`, defaulting to `model-training/output/bob-0.1-native`. `BOBAI_MODEL_NAME` and `BOBAI_CODING_MODEL_NAME` both default to `bob-0.1-native`. These names select profiles inside the BobAI native runtime; they are not remote model identifiers.

The API loads the model directly with Node.js. There is no Ollama URL, model server, API key, shell command, or provider process in the chat path. If the model file is absent, readiness reports the native model as unavailable instead of silently falling back to another provider.

## Model lifecycle

A future Bob-0.2 or Bob-1 can keep the same portable file contract while changing the architecture, tokenizer, dimensions, training data, or optimization strategy. The API model gateway stays stable. Model weights remain outside git and should be distributed through the user's own trusted storage or deployment process.

The included starter dataset is deliberately tiny and educational. A tiny model trained on it is a development proof, not a frontier-quality assistant. Better capability requires substantially more eligible training data, evaluation, compute, and iterative model versions.
