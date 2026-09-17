# Training control

BobAI training is controlled by repository-relative files under `model-training/output/bob-production/`, so relocating the repository from `C:` to `D:` does not require path edits.

For a repo at `D:\BobAi`:

```powershell
D:\BobAi\bob-training.cmd status
D:\BobAi\bob-training.cmd pause
D:\BobAi\bob-training.cmd resume
D:\BobAi\bob-training.cmd stop
```

`status` shows stage, profile, current/total steps, percent complete, loss, validation loss when available, elapsed time, ETA, and checkpoint path.

`pause` stops the active training child after the latest completed optimizer step has been checkpointed. `resume` restarts the saved stage using the profile and settings stored in `training-pipeline.json`. `stop` preserves the latest checkpoint but does not continue automatically.

The raw controller remains available directly:

```powershell
python model-training/training_control.py status
python model-training/training_control.py pause
python model-training/training_control.py stop
```

`latest.pt` is the resumable checkpoint. `best.pt` is the best validation checkpoint when available. The normal BobAI serving process is separate, so training can be paused to free resources before chatting with the latest checkpoint.
