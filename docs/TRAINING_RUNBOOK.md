# BobAI production training runbook

## Fresh start after moving the repo

If BobAI is now on a USB drive such as `D:\BobAi`, no training step needs to be manually repeated. The training scripts resolve paths from the repository itself, so moving the repo does not require editing hard-coded `C:` paths.

From anywhere in Command Prompt or PowerShell, run:

```powershell
D:\BobAi\bob-training.cmd start
```

If your folder name is different, replace `D:\BobAi` with the actual folder path. `start` is the complete fresh-run command. It installs the Python training requirements, builds the public knowledge corpus, prepares the train/validation splits, builds the instruction/capability corpus, trains the tokenizer, runs pretraining, then automatically continues into instruction tuning. You do not need to separately run `prepare_pretraining.py`, `prepare_dataset.py`, or `train_tokenizer.py`.

The bundled laptop preset uses the `dev` profile. That is the only profile we can reasonably treat as a default on the current low-memory laptop. It produces a real trainable model but is not a guarantee of big-model quality or a fixed 7–20 day runtime.

Running the fresh-start command passes the upstream-terms confirmation flag. Only run it after reviewing the dataset terms used by the corpus builder.

## Pause, inspect, resume, stop

Use a second terminal while training is active:

```powershell
D:\BobAi\bob-training.cmd status
D:\BobAi\bob-training.cmd pause
D:\BobAi\bob-training.cmd resume
D:\BobAi\bob-training.cmd stop
```

`status` reports the current stage, profile, step count, percentage, loss, validation loss when available, elapsed time, ETA, and checkpoint path. The raw JSON is stored at `model-training/output/bob-production/training-status.json`.

`pause` terminates the active training child only after the latest completed optimizer step has already been checkpointed. This frees the laptop's training resources. `resume` reads the saved pipeline state and original training configuration automatically, so you do not have to remember the profile or stage. `stop` preserves the latest checkpoint but leaves the run stopped.

## Talking to BobAI while paused

Training and serving are separate processes. After pausing, the normal BobAI app can use the latest completed production checkpoint if the production model runtime is configured to point at it. A checkpoint paused during pretraining may still be poor at conversation; checkpoints become meaningfully chat-oriented after instruction tuning has progressed.

## Checkpoints

- `model-training/output/bob-production/latest.pt` is the resume checkpoint.
- `model-training/output/bob-production/best.pt` is the best validation checkpoint when one has been produced.
- `model-training/output/bob-production/training-pipeline.json` stores the current stage and saved training settings.
- `model-training/output/bob-production/training-status.json` stores live progress.

## Production reality

The repository now supplies the complete reproducible laptop training flow and controls. Training time and resulting intelligence still depend on the actual hardware, amount/quality of data, parameter profile, optimization, and evaluation. Moving the repository to `D:` changes storage location, not the laptop's available RAM/compute.
