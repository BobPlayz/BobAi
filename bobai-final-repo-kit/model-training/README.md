# BobAI native model training

BobAI's native model is a from-scratch decoder-only transformer. Specialist research models exist for capabilities such as vision, speech and image generation.

## Large local corpus

Put training data you are legally allowed to use in:

`model-training/data/sources/`

Conversation-derived records must explicitly contain:

```json
{
  "eligible_for_training": true,
  "consent_scope": "preferences-and-conversations",
  "messages": [
    {"role": "user", "content": "hello"},
    {"role": "assistant", "content": "hello"}
  ]
}
```

Build up to 5.5 GB while keeping about 1 GB free:

```bash
python model-training/build_large_dataset.py --source-dir model-training/data/sources --output-dir model-training/data/large --max-gb 5.5
```

With overflow storage:

```bash
python model-training/build_large_dataset.py --source-dir model-training/data/sources --output-dir model-training/data/large --overflow-dir E:\BobAI-data --max-gb 5.5
```

The builder streams JSONL instead of loading the corpus into RAM, shards it, deduplicates it, redacts common secrets/basic PII, and enforces the existing consent boundary.

Do not pad the corpus with repeated data. Dataset quality matters more than raw GB.

## Important

A multi-GB corpus does not make a small transformer GPT-level. Model capacity, tokenizer, context length, compute, training-token count, data quality and evaluation all need to scale together.

Generated checkpoints and datasets are local artifacts and should not be committed to Git.
