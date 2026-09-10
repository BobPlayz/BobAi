# BobAI model training architecture

BobAI's long-term core model is **Bob**, owned and operated by the BobAI project. Core chat inference uses the Bob model gateway. Coding work uses separately configured coding models. Ollama is not a core dependency or inference path.

## Bob-0.1 is now scaffolded

The repository contains a small, reproducible first training target under `model-training/`:

- Base model: `Qwen/Qwen2.5-0.5B-Instruct`.
- Method: LoRA supervised fine-tuning (SFT).
- Dataset: JSONL conversational messages with an explicit eligibility/consent envelope.
- Preparation: deterministic sanitization, secret/PII redaction, deduplication, and train/validation/test splitting.
- Evaluation: fixed prompts plus deterministic smoke checks.
- Artifact: a PEFT/LoRA adapter, not a new foundation model.
- Serving contract: OpenAI-compatible `/v1/chat/completions`, matching BobAI's provider-neutral model gateway.

The starter examples are synthetic. Do not copy raw private conversations into the repository. The training policy is fail-closed and requires explicit eligibility and consent before examples enter the dataset.

See `model-training/README.md` for the exact local setup and commands.

## Personalization vs training

User preferences and memories are used at inference time to personalize Bob for that user. They are **not automatically turned into model weights**.

Model training is a separate, consent-gated pipeline:

1. The user explicitly enables `modelTraining.optIn` in settings.
2. Only eligible conversations from opted-in users are considered.
3. Sensitive secrets and direct identifiers are removed or rejected before dataset creation.
4. Preferences such as language, response style, and personality may be included as structured metadata when the user opted in.
5. Training datasets are versioned and kept separate from the production conversation store.
6. Dataset provenance records which policy/version produced each example.
7. Withdrawal stops future collection and triggers deletion handling for eligible training records.
8. Evaluation must test quality, safety, privacy leakage, memorization, and regression before a new Bob checkpoint is deployed.

## Important boundary

The repository can implement the data contract, consent controls, sanitization, dataset governance, evaluation harness, and model-serving interface. It cannot honestly manufacture a frontier-quality model or complete GPU training without actual model weights, compute, a tokenizer, a training stack, and an owned training environment.

The model-serving interface is intentionally provider-neutral/OpenAI-compatible so Bob's implementation can evolve from Bob-0.1 to a larger internally trained model without changing the application contract.

## Laptop phase → RTX phase

Bob-0.1 is the learning/validation phase. A modest laptop can prepare data and may be able to run the small LoRA experiment slowly. The same dataset format, evaluation harness, model registry, and serving contract can later be reused on a stronger RTX 3050 machine.

The larger model phase should change the model/training configuration, not the BobAI application architecture.

## Model quality target

To approach frontier-assistant quality, Bob's training program should combine:

- a strong pretrained base model or an internally pretrained model;
- high-quality instruction and reasoning data;
- coding and tool-use data;
- preference optimization from carefully reviewed human feedback;
- tool-use and agent trajectories;
- multimodal training when the model architecture supports it;
- retrieval/memory evaluation;
- adversarial safety evaluation;
- factuality and citation evaluation;
- long-context evaluation;
- latency/cost evaluation;
- privacy and memorization testing.

The application should never claim that a future checkpoint is "as powerful as" another model until benchmark and real-user evaluation demonstrates it.
