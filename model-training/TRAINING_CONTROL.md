# Training control

The production trainer writes `model-training/output/bob-production/training-status.json` and watches `training-control.json` through the managed runner.

Start a resumable run with an explicit total step budget:

```bash
python model-training/train_production_managed.py --stage pretrain --train model-training/data/pretrain/train.jsonl --validation model-training/data/pretrain/validation.jsonl --tokenizer model-training/output/bob-production/tokenizer.json --profile 350m --total-steps 100000 --chunk-steps 100
```

Inspect progress:

```bash
python model-training/training_control.py status
```

Pause safely:

```bash
python model-training/training_control.py pause
```

Resume:

```bash
python model-training/training_control.py resume
```

Stop after the current checkpoint boundary:

```bash
python model-training/training_control.py stop
```

The managed runner launches the existing trainer in bounded chunks and resumes from `latest.pt`, so pausing does not require killing a live training process. The normal BobAI API/model runtime remains a separate process and can continue serving the currently installed model while training is paused or running, subject to available CPU/RAM/GPU resources.

Status includes stage, current step, total steps, progress fraction, checkpoint path, state, and update time. ETA is intentionally calculated by the caller/UI from observed step throughput rather than stored as a permanent prediction.
