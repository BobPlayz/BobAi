from __future__ import annotations

import argparse, json, os, subprocess, sys, time
from pathlib import Path

ROOT=Path(__file__).resolve().parent
OUTPUT=ROOT/"output"/"bob-production"
CONTROL=OUTPUT/"training-control.json"
STATUS=OUTPUT/"training-status.json"
STATE=OUTPUT/"training-pipeline.json"
REQ=ROOT/"requirements.txt"
PAUSE_EXIT=75; STOP_EXIT=76


def write(path:Path,value:dict):
 path.parent.mkdir(parents=True,exist_ok=True); tmp=path.with_suffix(path.suffix+".tmp"); tmp.write_text(json.dumps(value,indent=2)+"\n",encoding="utf-8"); os.replace(tmp,path)
def read(path:Path,default):
 try:return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default
 except (OSError,json.JSONDecodeError):return default
def set_status(state:str,**extra): write(STATUS,{"state":state,"updated_at":time.time(),**extra})
def run_checked(cmd:list[str],stage:str):
 set_status("preparing",stage=stage); print("[bob-training] "+" ".join(map(str,cmd)),flush=True); subprocess.run(cmd,check=True)
def persisted_config(args,profile): return {"profile":profile,"english_limit":args.english_limit,"per_language_limit":args.per_language_limit,"pretrain_epochs":args.pretrain_epochs,"instruction_epochs":args.instruction_epochs,"batch_size":args.batch_size,"grad_accum":args.grad_accum,"precision":args.precision}

def train_stage(stage: str, train: Path, val: Path, tok: Path, cfg: dict, resume: bool=False, init_from: Path|None=None):
 cmd=[sys.executable,str(ROOT/"train_production.py"),"--stage",stage,"--train",str(train),"--validation",str(val),"--tokenizer",str(tok),"--output-dir",str(OUTPUT),"--profile",cfg["profile"],"--epochs",str(cfg["pretrain_epochs"] if stage=="pretrain" else cfg["instruction_epochs"]),"--batch-size",str(cfg["batch_size"]),"--grad-accum",str(cfg["grad_accum"]),"--precision",cfg["precision"],"--save-every","25"]
 checkpoint=OUTPUT/"latest.pt"
 if resume and checkpoint.exists(): cmd += ["--resume",str(checkpoint)]
 if init_from is not None: cmd += ["--init-from",str(init_from)]
 print("[bob-training] "+" ".join(map(str,cmd)),flush=True)
 proc=subprocess.Popen(cmd); state=read(STATE,{}) ; write(STATE,{**state,"stage":stage,"pid":proc.pid,"updated_at":time.time()})
 rc=proc.wait()
 if rc in {PAUSE_EXIT,STOP_EXIT}:
  action="pause" if rc==PAUSE_EXIT else "stop"; write(CONTROL,{"command":"idle","updated_at":time.time()}); return action
 if rc!=0:
  set_status("failed",stage=stage,exit_code=rc,checkpoint=str(checkpoint)); raise SystemExit(rc)
 return "done"

def main():
 p=argparse.ArgumentParser(description="One-command BobAI production training pipeline with resumable stages and laptop-safe controls.")
 p.add_argument("--confirm-upstream-terms",action="store_true"); p.add_argument("--profile",choices=["dev","125m","350m","1.3b","3b"],default=None); p.add_argument("--english-limit",type=int,default=100_000); p.add_argument("--per-language-limit",type=int,default=10_000); p.add_argument("--pretrain-epochs",type=int,default=1); p.add_argument("--instruction-epochs",type=int,default=2); p.add_argument("--batch-size",type=int,default=1); p.add_argument("--grad-accum",type=int,default=16); p.add_argument("--precision",choices=["fp32","fp16","bf16"],default="fp32"); p.add_argument("--skip-corpus",action="store_true"); p.add_argument("--skip-deps",action="store_true"); p.add_argument("--resume",action="store_true")
 a=p.parse_args(); OUTPUT.mkdir(parents=True,exist_ok=True); data=ROOT/"data"; pre=data/"pretrain"; tok=OUTPUT/"tokenizer.json"; write(CONTROL,{"command":"idle","updated_at":time.time()})
 if a.resume:
  saved=read(STATE,{})
  if not saved: raise SystemExit("no previous training pipeline state exists to resume")
  cfg=saved.get("config") if isinstance(saved.get("config"),dict) else {}
  if not cfg: raise SystemExit("saved training configuration is missing")
  stage=saved.get("stage")
  if stage not in {"pretrain","instruction"}: raise SystemExit(f"saved stage is not resumable: {stage}")
  set_status("resuming",stage=stage,profile=cfg.get("profile"),checkpoint=str(OUTPUT/"latest.pt"))
  if stage=="pretrain":
   result=train_stage("pretrain",pre/"train.jsonl",pre/"validation.jsonl",tok,cfg,resume=True)
   if result in {"pause","stop"}: return
   stage="instruction"; write(STATE,{"stage":stage,"config":cfg,"updated_at":time.time()})
  if stage=="instruction":
   result=train_stage("instruction",data/"train.jsonl",data/"validation.jsonl",tok,cfg,resume=True)
   if result in {"pause","stop"}: return
 else:
  profile=a.profile or "dev"; cfg=persisted_config(a,profile); write(STATE,{"stage":"preparing","config":cfg,"updated_at":time.time()})
  if not a.skip_deps: run_checked([sys.executable,"-m","pip","install","-r",str(REQ)],"dependencies")
  if not a.skip_corpus:
   if not a.confirm_upstream_terms: raise SystemExit("fresh training requires --confirm-upstream-terms after reviewing the upstream dataset terms")
   run_checked([sys.executable,str(ROOT/"build_pretraining_corpus.py"),"--confirm-upstream-terms","--english-limit",str(cfg["english_limit"]),"--per-language-limit",str(cfg["per_language_limit"])],"knowledge_corpus"); run_checked([sys.executable,str(ROOT/"prepare_pretraining.py")],"pretraining_split")
  if not (pre/"train.jsonl").exists() or not (pre/"validation.jsonl").exists(): raise SystemExit("pretraining split is missing; run a fresh start without --skip-corpus")
  run_checked([sys.executable,str(ROOT/"build_final_dataset.py")],"instruction_corpus"); run_checked([sys.executable,str(ROOT/"prepare_dataset.py"),"--input",str(data/"source.jsonl")],"instruction_split"); run_checked([sys.executable,str(ROOT/"train_tokenizer.py"),"--input",str(pre/"train.jsonl"),str(data/"train.jsonl"),"--output",str(tok)],"tokenizer")
  write(STATE,{"stage":"pretrain","config":cfg,"updated_at":time.time()}); result=train_stage("pretrain",pre/"train.jsonl",pre/"validation.jsonl",tok,cfg)
  if result in {"pause","stop"}: return
  init_checkpoint=OUTPUT/"best.pt" if (OUTPUT/"best.pt").exists() else OUTPUT/"latest.pt"
  if not init_checkpoint.exists(): raise SystemExit("pretraining finished without a checkpoint")
  write(STATE,{"stage":"instruction","config":cfg,"updated_at":time.time()}); result=train_stage("instruction",data/"train.jsonl",data/"validation.jsonl",tok,cfg,init_from=init_checkpoint)
  if result in {"pause","stop"}: return
 write(STATE,{"stage":"done","config":cfg,"updated_at":time.time()}); final_checkpoint=OUTPUT/"best.pt" if (OUTPUT/"best.pt").exists() else OUTPUT/"latest.pt"; set_status("completed",stage="done",profile=cfg.get("profile"),progress=1.0,checkpoint=str(final_checkpoint)); print("[bob-training] complete",flush=True)

if __name__=="__main__": main()
