from __future__ import annotations
import argparse,json,subprocess,sys,time
from pathlib import Path

ROOT=Path(__file__).resolve().parent
DEFAULT_OUT=ROOT/'output/bob-production'

def status(out,state,**extra):
 out.mkdir(parents=True,exist_ok=True); payload={'state':state,'updated_at':time.time(),**extra}; tmp=out/'training-status.json.tmp'; tmp.write_text(json.dumps(payload,indent=2)+'\n',encoding='utf-8'); tmp.replace(out/'training-status.json')

def command(out):
 p=out/'training-control.json'
 if not p.exists(): return 'run'
 try: return json.loads(p.read_text(encoding='utf-8')).get('command','run')
 except Exception: return 'run'

def set_command(out,value):
 out.mkdir(parents=True,exist_ok=True); p=out/'training-control.json'; tmp=p.with_suffix('.tmp'); tmp.write_text(json.dumps({'command':value,'updated_at':time.time()})+'\n',encoding='utf-8'); tmp.replace(p)

def main():
 p=argparse.ArgumentParser(description='Run BobAI training in checkpointed, pause/resume-safe chunks.')
 p.add_argument('--stage',choices=['pretrain','instruction'],required=True); p.add_argument('--train',type=Path,required=True); p.add_argument('--validation',type=Path,required=True); p.add_argument('--tokenizer',type=Path,required=True); p.add_argument('--output-dir',type=Path,default=DEFAULT_OUT); p.add_argument('--profile',default='350m'); p.add_argument('--epochs',type=int,default=1); p.add_argument('--batch-size',type=int,default=1); p.add_argument('--grad-accum',type=int,default=16); p.add_argument('--learning-rate',type=float,default=3e-4); p.add_argument('--weight-decay',type=float,default=.1); p.add_argument('--warmup-steps',type=int,default=100); p.add_argument('--total-steps',type=int,default=0); p.add_argument('--chunk-steps',type=int,default=100); p.add_argument('--save-every',type=int,default=100); p.add_argument('--eval-every',type=int,default=100); p.add_argument('--eval-batches',type=int,default=50); p.add_argument('--precision',choices=['fp32','fp16','bf16'],default='bf16'); p.add_argument('--gradient-checkpointing',action='store_true'); p.add_argument('--init-from',type=Path); p.add_argument('--seed',type=int,default=42)
 a=p.parse_args(); out=a.output_dir; total=a.total_steps; completed=0
 existing=out/'latest.pt'
 if existing.exists():
  try: import torch; completed=int(torch.load(existing,map_location='cpu',weights_only=False).get('step',0))
  except Exception: completed=0
 if total<=0:
  raise SystemExit('--total-steps is required for managed training so progress and resume semantics stay explicit')
 set_command(out,'run'); status(out,'running',stage=a.stage,total_steps=total,step=completed,progress=completed/total if total else 0,started_at=time.time())
 while completed<total:
  while command(out)=='pause':
   status(out,'paused',stage=a.stage,total_steps=total,step=completed,progress=completed/total,checkpoint=str(existing)); time.sleep(2)
  if command(out)=='stop':
   status(out,'stopped',stage=a.stage,total_steps=total,step=completed,progress=completed/total,checkpoint=str(existing)); return
  remaining=total-completed; chunk=min(a.chunk_steps,remaining); args=[sys.executable,str(ROOT/'train_production.py'),'--stage',a.stage,'--train',str(a.train),'--validation',str(a.validation),'--tokenizer',str(a.tokenizer),'--output-dir',str(out),'--profile',a.profile,'--epochs',str(a.epochs),'--batch-size',str(a.batch_size),'--grad-accum',str(a.grad_accum),'--learning-rate',str(a.learning_rate),'--weight-decay',str(a.weight_decay),'--warmup-steps',str(a.warmup_steps),'--max-steps',str(completed+chunk),'--save-every',str(a.save_every),'--eval-every',str(a.eval_every),'--eval-batches',str(a.eval_batches),'--precision',a.precision,'--seed',str(a.seed),'--resume',str(existing)]
  if a.gradient_checkpointing: args.append('--gradient-checkpointing')
  if a.init_from and completed==0: args += ['--init-from',str(a.init_from)]
  status(out,'running',stage=a.stage,total_steps=total,step=completed,progress=completed/total,chunk_steps=chunk,checkpoint=str(existing))
  result=subprocess.run(args)
  if result.returncode!=0:
   status(out,'error',stage=a.stage,total_steps=total,step=completed,progress=completed/total,exit_code=result.returncode,checkpoint=str(existing)); raise SystemExit(result.returncode)
  try:
   import torch; completed=int(torch.load(existing,map_location='cpu',weights_only=False).get('step',completed+chunk))
  except Exception: completed+=chunk
  if command(out)=='pause': status(out,'paused',stage=a.stage,total_steps=total,step=completed,progress=completed/total,checkpoint=str(existing))
 status(out,'completed',stage=a.stage,total_steps=total,step=completed,progress=1.0,checkpoint=str(existing)); print('[bob-training] managed training complete',flush=True)

if __name__=='__main__': main()
