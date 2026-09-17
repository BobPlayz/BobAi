BobAI handoff: the repository-side production AI architecture and long-running training controls are implemented. The operator flow is intentionally reduced to one training command plus separate controls.

If the user has already completed `prepare_pretraining.py`, the next command is:

```powershell
python model-training/pipeline.py --skip-corpus --profile dev
```

For a fresh run from the selected public corpora:

```powershell
python model-training/pipeline.py --confirm-upstream-terms --profile dev
```

That single pipeline command handles instruction/capability dataset preparation, tokenizer training, pretraining, pretrained-to-instruction checkpoint transfer, and final checkpoints. The current default `dev` profile is the laptop-oriented configuration. It is not a promise of frontier quality or a guaranteed 7–20 day runtime.

During the long run, use another terminal for:

```powershell
python model-training/training_control.py status
python model-training/training_control.py pause
python model-training/pipeline.py --resume --profile dev
python model-training/training_control.py stop
```

Pause/stop preserves `model-training/output/bob-production/latest.pt`. The pipeline records its current stage in `training-pipeline.json`; resume continues from that stage/checkpoint. Status is persistent JSON in `training-status.json`. The training process is separate from the normal BobAI serving/chat process, so when training is paused the latest completed checkpoint can be used for interactive chat while the training resources are free.

The production architecture includes a scalable from-scratch Transformer, multilingual knowledge pretraining, instruction/capability training, BPE tokenizer training, checkpointing, validation, DDP, mixed precision, production evaluation, bounded model workers, and broad runtime tool boundaries. User-focused targets explicitly include text, coding, UI/UX design, voice, research, files, agents, computer use, Paint, Blender/3D, vision, image/video/audio/music, memory, APIs, databases, automation, deployment, security, recovery, multilingual conversation, and teaching. Runtime tools remain separate from model weights so current web information, file retrieval, desktop control, and external media providers can be permissioned and verified.

The repository-side work is complete for this architecture. Remaining work is external execution: licensed training/multimodal assets and permitted teacher outputs, sufficient compute/storage, actual training/evaluation, real provider configuration, BobHS infrastructure, native Windows media builds, and final load/security/resilience verification for roughly 2,000 daily users. A fixed number of training days cannot guarantee a frontier-equivalent model.

Future work must inspect `main` first, keep `roadmap.md` and this handoff synchronized in the same commit, and implement actionable repo-side fixes rather than merely reporting them.
