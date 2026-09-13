BobAI final repo kit

Run ONE command from the BobAI repository root:

powershell -ExecutionPolicy Bypass -File .\bobai-final-repo-kit\INSTALL.ps1

This installs the dataset infrastructure and repo-side training updates.

Then build a large local corpus:

python model-training\build_large_dataset.py --source-dir model-training\data\sources --output-dir model-training\data\large --overflow-dir E:\BobAI-data

Replace E:\BobAI-data with the pendrive drive/path.

The kit does not contain copyrighted or scraped training data. It builds the infrastructure for data you are legally allowed to use. Conversation-derived data remains explicitly consent-gated and privacy-filtered.

A multi-GB dataset alone cannot make the current small native model GPT-level. Model capacity, compute, tokenizer, context, training tokens, data quality and evaluation all matter.
