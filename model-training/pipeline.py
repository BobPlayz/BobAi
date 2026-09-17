from __future__ import annotations

import argparse,json,os,subprocess,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parent
OUTPUT=ROOT/"output/bob-production"
CONTROL=OUTPUT/"training-control.json"
STATUS=OUTPUT/"training-status.json"
STATE=OUTPUT/"training-pipeline.json"

def write(path,value):
 path.parent.mkdir(parents=True,exist_ok=True); tmp=path.with_suffix(path.suffix+'.tmp'); tmp.write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8'); os.replace(tmp,path)
def read(path,default):
 try:return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default
 except (OSError,json.JSONDecodeError):return default
def command(): return read(CONTROL,{}).get('command','idle')
def set_status(state,**extra): write(STATUS,{'state':state,'updated_at':time.time(),**extra})
def run(cmd): print('[bob-training] '+' '.join(map(str,cmd)),flush=True); return subprocess.Popen(cmd)
def wait_for_resume(stage):
 set_status('paused',stage=stage,checkpoint=str(OUTPUT/'latest.pt'))
 while True:
  c=command()
  if c=='stop': set_status('stopped',stage=stage,checkpoint=str(OUTPUT/'latest.pt')); return False
  if c=='resume':
   write(CONTROL,{'command':'idle','updated_at':time.time()}); return True
  time.sleep(1)
def train_stage(stage,train,val,tok,profile,epochs,batch,grad,precision,resume=False,init_from=None):
 cmd=[sys.executable,str(ROOT/'train_production.py'),'--stage',stage,'--train',str(train),'--validation',str(val),'--tokenizer',str(tok),'--output-dir',str(OUTPUT),'--profile',profile,'--epochs',str(epochs),'--batch-size',str(batch),'--grad-accum',str(grad),'--precision',precision,'--save-every','1']
 if resume: cmd += ['--resume',str(OUTPUT/'latest.pt')]
 if init_from: cmd += ['--init-from',str(init_from)]
 proc=run(cmd); write(STATE,{'stage':stage,'pid':proc.pid,'updated_at':time.time()})
 while proc.poll() is None:
  c=command()
  if c in ('pause','stop'):
   target='pausing' if c=='pause' else 'stopping'; set_status(target,stage=stage,pid=proc.pid,checkpoint=str(OUTPUT/'latest.pt'))
   proc.terminate()
   try: proc.wait(timeout=20)
   except subprocess.TimeoutExpired: proc.kill(); proc.wait()
   write(CONTROL,{'command':'idle','updated_at':time.time()})
   if c=='stop': set_status('stopped',stage=stage,checkpoint=str(OUTPUT/'latest.pt')); return 'stop'
   return 'pause'
  time.sleep(1)
 if proc.returncode!=0: set_status('failed',stage=stage,exit_code=proc.returncode); raise SystemExit(proc.returncode)
 return 'done'
def main():
 p=argparse.ArgumentParser(description='One-command BobAI production training pipeline with safe pause/resume.')
 p.add_argument('--confirm-upstream-terms',action='store_true'); p.add_argument('--profile',choices=['dev','125m','350m','1.3b','3b'],default='dev'); p.add_argument('--english-limit',type=int,default=100_000); p.add_argument('--per-language-limit',type=int,default=10_000); p.add_argument('--pretrain-epochs',type=int,default=1); p.add_argument('--instruction-epochs',type=int,default=2); p.add_argument('--batch-size',type=int,default=1); p.add_argument('--grad-accum',type=int,default=16); p.add_argument('--precision',choices=['fp32','fp16','bf16'],default='fp32'); p.add_argument('--skip-corpus',action='store_true'); p.add_argument('--resume',action='store_true')
 a=p.parse_args(); data=ROOT/'data'; pre=data/'pretrain'; out=OUTPUT; out.mkdir(parents=True,exist_ok=True)
 if a.resume:
  saved=read(STATE,{}); stage=saved.get('stage','pretrain'); write(CONTROL,{'command':'idle','updated_at':time.time()})
  if stage=='pretrain': result=train_stage('pretrain',pre/'train.jsonl',pre/'validation.jsonl',out/'tokenizer.json',a.profile,a.pretrain_epochs,a.batch_size,a.grad_accum,a.precision,True)
  else: result=train_stage('instruction',data/'train.jsonl',data/'validation.jsonl',out/'tokenizer.json',a.profile,a.instruction_epochs,a.batch_size,a.grad_accum,a.precision,True)
  if result=='pause': return
  if result=='stop': return
  stage='instruction' if stage=='pretrain' else 'done'
 else:
  if not a.skip_corpus:
   if not a.confirm_upstream_terms: raise SystemExit('pass --confirm-upstream-terms after reviewing upstream dataset terms')
   subprocess.run([sys.executable,str(ROOT/'build_pretraining_corpus.py'),'--confirm-upstream-terms','--english-limit',str(a.english_limit),'--per-language-limit',str(a.per_language_limit)],check=True)
   subprocess.run([sys.executable,str(ROOT/'prepare_pretraining.py')],check=True)
  subprocess.run([sys.executable,str(ROOT/'build_final_dataset.py')],check=True)
  subprocess.run([sys.executable,str(ROOT/'prepare_dataset.py'),'--input',str(data/'source.jsonl')],check=True)
  subprocess.run([sys.executable,str(ROOT/'train_tokenizer.py'),'--input',str(pre/'train.jsonl'),str(data/'train.jsonl'),'--output',str(out/'tokenizer.json')],check=True)
  stage='pretrain'; result=train_stage('pretrain',pre/'train.jsonl',pre/'validation.jsonl',out/'tokenizer.json',a.profile,a.pretrain_epochs,a.batch_size,a.grad_accum,a.precision)
  if result=='pause': return
  if result=='stop': return
 if stage=='instruction':
  result=train_stage('instruction',data/'train.jsonl',data/'validation.jsonl',out/'tokenizer.json',a.profile,a.instruction_epochs,a.batch_size,a.grad_accum,a.precision,False,out/'best.pt')
  if result in ('pause','stop'): return
 write(STATE,{'stage':'done','updated_at':time.time()}); set_status('completed',stage='done',checkpoint=str(out/'best.pt'))
 print('[bob-training] complete',flush=True)
if __name__=='__main__': main()
