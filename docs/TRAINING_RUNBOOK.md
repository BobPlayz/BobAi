# BobAI training runbook

This is the practical laptop runbook for the production-model pipeline. Training and serving are separate processes so the latest checkpoint can be used for a chat session after training is paused.

## 1. Install dependencies

```powershell
python -m pip install -r model-training\requirements.txt
```

## 2. Build the datasets

Review the upstream dataset terms first, then run:

```powershell
python model-training\build_pretraining_corpus.py --confirm-upstream-terms
python model-training\prepare_pretraining.py
python model-training\build_final_dataset.py
python model-training\prepare_dataset.py --input model-training\data\source.jsonl
```

## 3. Train the tokenizer

```powershell
python model-training\train_tokenizer.py --input model-training\data\pretrain\train.jsonl model-training\data\train.jsonl --output model-training\output\bob-production\tokenizer.json
```

## 4. Start controllable pretraining

For the laptop/dev profile:

```powershell
python model-training\training_supervisor.py start --stage pretrain --train model-training\data\pretrain\train.jsonl --validation model-training\data\pretrain\validation.jsonl --tokenizer model-training\output\bob-production\tokenizer.json --profile dev --epochs 1 --batch-size 1 --grad-accum 16 --precision fp32
```

The supervisor launches the trainer with a checkpoint after every optimizer step. This trades some I/O for much safer long-running pause/recovery behavior.

## 5. Check progress

Open another terminal:

```powershell
python model-training\training_control.py status
```

The detailed status is stored at `model-training/output/bob-production/training-status.json`. Checkpoints are `latest.pt` and, after validation improvement, `best.pt`.

## 6. Pause

```powershell
python model-training\training_control.py pause
```

The supervisor stops the training child after the latest completed checkpoint and records the run as paused. Do not delete `latest.pt`.

## 7. Talk to Bob while paused

Start BobAI normally and use the production checkpoint through the normal local model runtime. Because the training child has stopped, it no longer holds the training process resources.

On a low-memory laptop, a large checkpoint may not fit comfortably alongside the web/API stack. The `dev` profile is the practical local interactive profile; larger profiles are intended for machines with suitable VRAM/RAM.

## 8. Resume

After the chat session is finished:

```powershell
python model-training\training_supervisor.py resume --stage pretrain --train model-training\data\pretrain\train.jsonl --validation model-training\data\pretrain\validation.jsonl --tokenizer model-training\output\bob-production\tokenizer.json --profile dev --epochs 1 --batch-size 1 --grad-accum 16 --precision fp32
```

`latest.pt` restores the model, optimizer, scheduler, step, epoch, and validation state.

## 9. Stop cleanly

```powershell
python model-training\training_control.py stop
```

The latest completed checkpoint remains available for a later resume.

## 10. Instruction tuning

After pretraining is complete and evaluated:

```powershell
python model-training\training_supervisor.py start --stage instruction --train model-training\data\train.jsonl --validation model-training\data\validation.jsonl --tokenizer model-training\output\bob-production\tokenizer.json --profile dev --epochs 2 --batch-size 1 --grad-accum 16 --precision fp32 --init-from model-training\output\bob-production\best.pt
```

## 11. Evaluate

```powershell
python model-training\evaluate_production.py --checkpoint model-training\output\bob-production\best.pt --tokenizer model-training\output\bob-production\tokenizer.json
```

## 12. One-command pipeline

For an unattended run:

```powershell
python model-training\pipeline.py --confirm-upstream-terms --profile dev
```

For suitable larger hardware:

```powershell
python model-training\pipeline.py --confirm-upstream-terms --profile 350m
```

Use the supervisor when you want reliable pause/resume and checkpoint control.

## 13. Multi-GPU

The production trainer supports `torchrun`/DDP. A laptop normally uses one process.

## Important reality

Seven to twenty days is a runtime estimate, not a model-quality guarantee. Actual time depends on hardware, corpus size, profile, context length, batch size, and tokens processed. Serving roughly 2,000 daily users also requires separate inference capacity, storage, monitoring, provider infrastructure, and load testing.
