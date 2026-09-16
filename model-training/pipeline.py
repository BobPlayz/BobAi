from __future__ import annotations

import argparse, subprocess, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parent

def run(cmd:list[str]):
 print("[bob-training]", " ".join(str(x) for x in cmd), flush=True); subprocess.run(cmd,check=True)

def main():
 p=argparse.ArgumentParser(description="Run the complete BobAI production-model data/tokenizer/pretrain/instruction pipeline.")
 p.add_argument("--confirm-upstream-terms",action="store_true"); p.add_argument("--profile",choices=["dev","125m","350m","1.3b","3b"],default="350m"); p.add_argument("--english-limit",type=int,default=100_000); p.add_argument("--per-language-limit",type=int,default=10_000); p.add_argument("--pretrain-epochs",type=int,default=1); p.add_argument("--instruction-epochs",type=int,default=2); p.add_argument("--batch-size",type=int,default=1); p.add_argument("--grad-accum",type=int,default=16); p.add_argument("--precision",choices=["fp32","fp16","bf16"],default="bf16"); p.add_argument("--skip-corpus",action="store_true"); p.add_argument("--skip-instruction",action="store_true"); p.add_argument("--max-pretrain-steps",type=int,default=0); p.add_argument("--max-instruction-steps",type=int,default=0)
 a=p.parse_args(); py=sys.executable; data=ROOT/"data"; pretrain=data/"pretrain"; output=ROOT/"output/bob-production"
 if not a.skip_corpus:
  if not a.confirm_upstream_terms: raise SystemExit("pass --confirm-upstream-terms after reviewing upstream dataset terms")
  run([py,str(ROOT/"build_pretraining_corpus.py"),"--confirm-upstream-terms","--english-limit",str(a.english_limit),"--per-language-limit",str(a.per_language_limit)])
  run([py,str(ROOT/"prepare_pretraining.py")])
  run([py,str(ROOT/"build_final_dataset.py")])
  run([py,str(ROOT/"prepare_dataset.py"),"--input",str(data/"source.jsonl")])
 run([py,str(ROOT/"train_tokenizer.py"),"--input",str(pretrain/"train.jsonl"),str(data/"train.jsonl"),"--output",str(output/"tokenizer.json")])
 if not (a.skip_corpus or a.skip_instruction):
  run([py,str(ROOT/"train_production.py"),"--stage","pretrain","--train",str(pretrain/"train.jsonl"),"--validation",str(pretrain/"validation.jsonl"),"--tokenizer",str(output/"tokenizer.json"),"--output-dir",str(output),"--profile",a.profile,"--epochs",str(a.pretrain_epochs),"--batch-size",str(a.batch_size),"--grad-accum",str(a.grad_accum),"--precision",a.precision,*(["--max-steps",str(a.max_pretrain_steps)] if a.max_pretrain_steps else [])])
  run([py,str(ROOT/"train_production.py"),"--stage","instruction","--train",str(data/"train.jsonl"),"--validation",str(data/"validation.jsonl"),"--tokenizer",str(output/"tokenizer.json"),"--output-dir",str(output),"--profile",a.profile,"--epochs",str(a.instruction_epochs),"--batch-size",str(a.batch_size),"--grad-accum",str(a.grad_accum),"--precision",a.precision,"--init-from",str(output/"best.pt"),*(["--max-steps",str(a.max_instruction_steps)] if a.max_instruction_steps else [])])
 elif not a.skip_instruction:
  run([py,str(ROOT/"train_production.py"),"--stage","instruction","--train",str(data/"train.jsonl"),"--validation",str(data/"validation.jsonl"),"--tokenizer",str(output/"tokenizer.json"),"--output-dir",str(output),"--profile",a.profile,"--epochs",str(a.instruction_epochs),"--batch-size",str(a.batch_size),"--grad-accum",str(a.grad_accum),"--precision",a.precision,"--init-from",str(output/"best.pt")])
 print("[bob-training] pipeline complete; evaluate with evaluate_production.py and deploy only after target-environment verification")

if __name__=="__main__": main()
