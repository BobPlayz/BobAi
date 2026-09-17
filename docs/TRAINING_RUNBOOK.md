# BobAI production training runbook

## Fresh start on the USB drive

If the repo lives at `D:\BobAi`, run this from anywhere:

```powershell
D:\BobAi\bob-training.cmd start
```

Replace `D:\BobAi` only if your actual folder name is different. That single command installs training dependencies, prepares the public knowledge corpus, creates pretraining/instruction splits, trains the tokenizer, runs pretraining, then automatically continues into instruction tuning. No earlier manual training command needs to be finished first.

The scripts resolve their own repository path, so moving BobAI from `C:` to `D:` does not require code edits.

## Controls

```powershell
D:\BobAi\bob-training.cmd status
D:\BobAi\bob-training.cmd pause
D:\BobAi\bob-training.cmd resume
D:\BobAi\bob-training.cmd stop
```

`status` shows stage, profile, step/total, percentage, loss, validation loss when available, elapsed time, ETA, and checkpoint path.

`pause` and `stop` are cooperative. The trainer finishes the current optimizer step, writes `latest.pt`, records its state, and exits cleanly. This may take a little while if one optimizer step is slow. Normal checkpoints are spaced out so a USB flash drive is not hammered with a complete model write every step.

`resume` reads the saved stage/profile/settings from `training-pipeline.json` and continues from `latest.pt` automatically.

## Files

- `model-training/output/bob-production/latest.pt`: resume checkpoint
- `model-training/output/bob-production/best.pt`: best validation checkpoint, when available
- `model-training/output/bob-production/training-pipeline.json`: saved stage/settings
- `model-training/output/bob-production/training-status.json`: live progress

## Talking to BobAI while paused

Training and serving are separate. After pause completes, the training process has exited and released its CPU/RAM/GPU resources. The normal BobAI app can then load a completed checkpoint. A checkpoint from early pretraining may produce poor chat responses; conversational behavior improves during instruction tuning.

## Hardware reality

The bundled one-command preset is `dev`, chosen because the current laptop is memory-limited. The displayed ETA is measured from actual step throughput after training begins. It is more useful than guessing a fixed 7–20 day duration in advance. USB storage can also be slower than the laptop's internal drive, especially for checkpoint writes.
