# BobAI production training runbook

## Minimal operator flow

If `prepare_pretraining.py` has already finished, you do **not** need to manually run every dataset/tokenizer/training command.

Run one command:

```powershell
python model-training/pipeline.py --skip-corpus --profile dev
```

For a completely fresh run, including the public-corpus preparation:

```powershell
python model-training/pipeline.py --confirm-upstream-terms --profile dev
```

The pipeline builds the instruction/capability data, trains one tokenizer over knowledge + instruction text, pretrains the production model, transfers the best pretrained checkpoint into instruction tuning, and keeps `latest.pt` and `best.pt` under `model-training/output/bob-production/`.

`dev` is the practical profile for a laptop. Larger profiles require substantially stronger compute. Training duration is hardware/data dependent, so a 7–20 day estimate is not a guarantee.

## Pause, inspect, resume

Leave the training command running. From another terminal:

```powershell
python model-training/training_control.py status
```

To pause safely:

```powershell
python model-training/training_control.py pause
```

The pipeline stops the training child and preserves the latest checkpoint. You can then run BobAI separately against the latest completed checkpoint while the training GPU/CPU is free.

Resume the same pipeline stage from `latest.pt`:

```powershell
python model-training/pipeline.py --resume --profile dev
```

To stop while preserving the latest checkpoint:

```powershell
python model-training/training_control.py stop
```

`status` reads `training-status.json`; the checkpoint is `latest.pt`; the best validation checkpoint is `best.pt`. The pipeline state records whether it was in pretraining or instruction tuning so `--resume` knows what stage to continue.

## What the production model does

The model is the language/reasoning core. BobAI runtime tools provide capabilities that should not be forced into model weights: current web research, file retrieval, coding sandboxes, browser/computer control, Paint, Blender, memory, APIs, deployment, and external image/video/audio/music/voice providers. These remain permissioned, bounded, audited, and verified.

The training target includes natural conversation, reasoning, multilingual and code-switching behavior, source checking, coding, UI/UX design, software-factory workflows, voice/turn-taking, vision, media, computer use, Paint, Blender/3D, memory, security, recovery, APIs, databases, automation, deployment, and teaching.

## Production reality

The repository supplies the architecture and reproducible training/serving machinery. It does not supply the external GPU compute, storage, licensed multimodal assets, permitted teacher-model outputs, provider accounts, or the final trained weights. Those must exist in the execution environment. The repository therefore does not promise that a fixed number of days or a fixed parameter profile will produce frontier-level intelligence.
