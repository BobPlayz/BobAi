# BobAI production training

`bob-0.2-native` is the small development/sanity model. `bob-production` is the scalable from-scratch Transformer used for real training and deployment. The production path is intentionally separate from Ollama and hosted model APIs.

## Complete pipeline

The recommended entry point is:

```bash
python model-training/pipeline.py --confirm-upstream-terms --profile 350m
```

This pipeline:

1. streams the selected licensed public knowledge corpora (`FineWeb-Edu` English and selected `FineWeb-2` language configs),
2. deterministically hashes/deduplicates the raw corpus,
3. creates a held-out pretraining split,
4. builds the existing BobAI instruction/capability corpus,
5. trains one BPE tokenizer over pretraining + instruction text,
6. pretrains the production Transformer,
7. transfers the pretrained weights into the instruction stage, and
8. writes resumable checkpoints and model metadata.

The corpus builder requires an explicit `--confirm-upstream-terms` because upstream CommonCrawl/ODC-By terms apply. Private chat history is never automatically ingested.

For a smoke run, use `--profile dev`, small corpus limits, and `--max-pretrain-steps` / `--max-instruction-steps`. For real training, increase corpus limits and run on suitable GPU compute and storage.

## Manual stages

```bash
python model-training/build_pretraining_corpus.py --confirm-upstream-terms
python model-training/prepare_pretraining.py
python model-training/build_final_dataset.py
python model-training/prepare_dataset.py --input model-training/data/source.jsonl
python model-training/train_tokenizer.py --input model-training/data/pretrain/train.jsonl model-training/data/train.jsonl
python model-training/train_production.py --stage pretrain --train model-training/data/pretrain/train.jsonl --validation model-training/data/pretrain/validation.jsonl --tokenizer model-training/output/bob-production/tokenizer.json --profile 350m
python model-training/train_production.py --stage instruction --train model-training/data/train.jsonl --validation model-training/data/validation.jsonl --tokenizer model-training/output/bob-production/tokenizer.json --profile 350m --init-from model-training/output/bob-production/best.pt
python model-training/evaluate_production.py --checkpoint model-training/output/bob-production/best.pt --tokenizer model-training/output/bob-production/tokenizer.json
```

Use `torchrun` with `train_production.py` for multi-GPU DDP. `--resume` restores optimizer/scheduler/model state. `--init-from` transfers model weights only and is intended for pretraining → instruction fine-tuning.

## Profiles

`dev`, `125m`, `350m`, `1.3b`, and `3b` are architecture profiles, not promises of frontier quality. A model's capability comes from architecture, training data, training compute, optimization, post-training, evaluation, and runtime tools together.

## Runtime

The Node API automatically uses `bob-production` when its tokenizer/checkpoint exist. `productionModelRuntime.ts` can launch a bounded local worker pool using `BOBAI_PRODUCTION_MODEL_WORKERS`, while BobHS can provide the deployment layer for larger fleets.

Production user capabilities are not supposed to live entirely in model weights. Web search, files/RAG, coding sandboxes, computer use, Paint, Blender, image/video/audio/music providers, memory, APIs, and automations are runtime capabilities with their own permissions, verification, and provider boundaries.

## Teacher models and multimodal data

Teacher-model outputs require explicit rights confirmation and provenance. Multimodal assets are mounted and validated by `build_multimodal_manifest.py`; their files are not silently copied into Git or treated as universally licensed. Use only assets and outputs that the operator is authorized to train on.

## Production truth

Repository code can make the training and serving system ready, reproducible, resumable, and scalable. It cannot manufacture GPU compute, external provider accounts, licensed datasets that have not been mounted, or the final learned weights. Those are execution dependencies outside the repository.
