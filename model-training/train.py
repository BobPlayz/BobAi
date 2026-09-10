from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import torch
from datasets import load_dataset
from peft import LoraConfig
from transformers import AutoModelForCausalLM, AutoTokenizer, set_seed
from trl import SFTConfig, SFTTrainer

ROOT = Path(__file__).resolve().parent


def load_config() -> dict:
    return json.loads((ROOT / "config.json").read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Fine-tune Bob-0.1 with LoRA.")
    parser.add_argument("--model", default=None, help="Override the base model id.")
    parser.add_argument("--output", default=None, help="Override the adapter output directory.")
    args = parser.parse_args()

    config = load_config()
    model_id = args.model or os.environ.get("BOBAI_TRAIN_BASE_MODEL") or config["base_model"]
    output_dir = Path(args.output or ROOT / "output" / config["model_id"])
    train_path = ROOT / "data" / "train.jsonl"
    validation_path = ROOT / "data" / "validation.jsonl"
    if not train_path.exists() or not validation_path.exists():
        raise SystemExit("Run prepare_dataset.py first so train.jsonl and validation.jsonl exist.")

    set_seed(int(config["seed"]))
    tokenizer = AutoTokenizer.from_pretrained(model_id, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    dtype = torch.float32
    if torch.cuda.is_available() and torch.cuda.is_bf16_supported():
        dtype = torch.bfloat16

    model = AutoModelForCausalLM.from_pretrained(model_id, torch_dtype=dtype)
    model.config.use_cache = False

    dataset = load_dataset(
        "json",
        data_files={"train": str(train_path), "validation": str(validation_path)},
    )

    lora = LoraConfig(
        r=int(config["lora_r"]),
        lora_alpha=int(config["lora_alpha"]),
        lora_dropout=float(config["lora_dropout"]),
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=list(config["target_modules"]),
    )

    training_args = SFTConfig(
        output_dir=str(output_dir),
        num_train_epochs=float(config["num_train_epochs"]),
        per_device_train_batch_size=int(config["per_device_train_batch_size"]),
        per_device_eval_batch_size=int(config["per_device_eval_batch_size"]),
        gradient_accumulation_steps=int(config["gradient_accumulation_steps"]),
        learning_rate=float(config["learning_rate"]),
        warmup_ratio=float(config["warmup_ratio"]),
        logging_steps=int(config["logging_steps"]),
        save_strategy=config["save_strategy"],
        eval_strategy=config["evaluation_strategy"],
        max_length=int(config["max_seq_length"]),
        packing=False,
        gradient_checkpointing=True,
        optim="adamw_torch",
        report_to=[],
        bf16=dtype == torch.bfloat16,
        fp16=False,
        seed=int(config["seed"]),
        dataset_num_proc=1,
    )

    trainer = SFTTrainer(
        model=model,
        args=training_args,
        train_dataset=dataset["train"],
        eval_dataset=dataset["validation"],
        processing_class=tokenizer,
        peft_config=lora,
    )
    trainer.train()
    trainer.save_model(str(output_dir))
    tokenizer.save_pretrained(str(output_dir))

    metadata = {
        "model_id": config["model_id"],
        "base_model": model_id,
        "method": "lora-sft",
        "adapter_path": str(output_dir),
        "torch_device": "cuda" if torch.cuda.is_available() else "cpu",
        "torch_dtype": str(dtype),
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "bob-model.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
