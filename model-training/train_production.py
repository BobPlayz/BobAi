from __future__ import annotations

import argparse, json, math, os, random
from pathlib import Path
from typing import Any
import torch
import torch.distributed as dist
from torch import nn
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.utils.data import DataLoader, Dataset, DistributedSampler
from tokenizers import Tokenizer
from production_model import BobProductionLM, ProductionConfig, parameter_count

PROFILES={"dev":{"context_size":512,"d_model":256,"n_heads":8,"n_kv_heads":4,"n_layers":8,"ffn_dim":768},"125m":{"context_size":2048,"d_model":768,"n_heads":12,"n_kv_heads":4,"n_layers":12,"ffn_dim":2048},"350m":{"context_size":4096,"d_model":1024,"n_heads":16,"n_kv_heads":4,"n_layers":24,"ffn_dim":2816},"1.3b":{"context_size":8192,"d_model":2048,"n_heads":32,"n_kv_heads":8,"n_layers":24,"ffn_dim":5504},"3b":{"context_size":8192,"d_model":2560,"n_heads":32,"n_kv_heads":8,"n_layers":32,"ffn_dim":6912}}
ROLES={"system":"<|system|>","user":"<|user|>","assistant":"<|assistant|>"}

class JsonlDataset(Dataset):
 def __init__(self,path:Path,tok:Tokenizer,context:int):
  self.path=path; self.tok=tok; self.context=context; self.offsets=[]
  with path.open("rb") as f:
   while True:
    off=f.tell(); line=f.readline()
    if not line: break
    if line.strip(): self.offsets.append(off)
  if not self.offsets: raise ValueError(f"no records found in {path}")
  self.pad=tok.token_to_id("<|pad|>")
  if self.pad is None: raise ValueError("tokenizer is missing <|pad|>")
 def __len__(self): return len(self.offsets)
 def format(self,row:dict[str,Any])->str:
  if isinstance(row.get("text"),str) and row["text"].strip(): return row["text"].strip()
  parts=["<|bos|>"]
  for m in row.get("messages",[]):
   if isinstance(m,dict) and m.get("role") in ROLES and isinstance(m.get("content"),str) and m["content"].strip(): parts.append(f"{ROLES[m['role']]}\n{m['content'].strip()}")
  parts.append("<|eos|>"); return "\n".join(parts)
 def __getitem__(self,i):
  with self.path.open("rb") as f: f.seek(self.offsets[i]); row=json.loads(f.readline().decode("utf-8"))
  ids=self.tok.encode(self.format(row),add_special_tokens=False).ids[:self.context+1]
  if len(ids)<2: ids=[int(self.pad),int(self.pad)]
  x,y=ids[:-1],ids[1:]; n=len(x); p=self.context-n
  return torch.tensor(x+[int(self.pad)]*p,dtype=torch.long),torch.tensor(y+[-100]*p,dtype=torch.long),torch.tensor(n)

def setup():
 world=int(os.getenv("WORLD_SIZE","1")); rank=int(os.getenv("RANK","0")); local=int(os.getenv("LOCAL_RANK","0")); enabled=world>1
 if enabled: dist.init_process_group("nccl" if torch.cuda.is_available() else "gloo")
 return rank,local,world,enabled

def unwrap(m): return m.module if isinstance(m,DDP) else m

def save(path,model,opt,sched,step,epoch,config,tok,best,stage):
 path.parent.mkdir(parents=True,exist_ok=True); torch.save({"format":"bob-production-v2","stage":stage,"model":unwrap(model).state_dict(),"optimizer":opt.state_dict(),"scheduler":sched.state_dict(),"step":step,"epoch":epoch,"config":config.to_dict(),"tokenizer":str(tok),"best_validation_loss":best},path)

def evaluate(model,loader,device,amp,dtype,max_batches):
 model.eval(); vals=[]
 with torch.no_grad():
  for i,(x,y,_) in enumerate(loader):
   if i>=max_batches: break
   x,y=x.to(device),y.to(device)
   with torch.autocast(device_type=device.type,dtype=dtype,enabled=amp):
    logits=model(x); loss=nn.functional.cross_entropy(logits.reshape(-1,logits.size(-1)),y.reshape(-1),ignore_index=-100)
   vals.append(float(loss.detach().cpu()))
 model.train(); return sum(vals)/max(1,len(vals))

def main():
 p=argparse.ArgumentParser(description="Train BobAI's scalable production Transformer. Use pretrain first, then instruction with --init-from.")
 p.add_argument("--stage",choices=["pretrain","instruction"],default="instruction"); p.add_argument("--train",type=Path,required=True); p.add_argument("--validation",type=Path,required=True); p.add_argument("--tokenizer",type=Path,required=True); p.add_argument("--output-dir",type=Path,default=Path("model-training/output/bob-production")); p.add_argument("--profile",choices=sorted(PROFILES),default="350m"); p.add_argument("--epochs",type=int,default=1); p.add_argument("--batch-size",type=int,default=1); p.add_argument("--grad-accum",type=int,default=16); p.add_argument("--learning-rate",type=float,default=3e-4); p.add_argument("--weight-decay",type=float,default=.1); p.add_argument("--warmup-steps",type=int,default=100); p.add_argument("--max-steps",type=int,default=0); p.add_argument("--save-every",type=int,default=500); p.add_argument("--eval-every",type=int,default=500); p.add_argument("--eval-batches",type=int,default=50); p.add_argument("--seed",type=int,default=42); p.add_argument("--precision",choices=["fp32","fp16","bf16"],default="bf16"); p.add_argument("--gradient-checkpointing",action="store_true"); p.add_argument("--resume",type=Path); p.add_argument("--init-from",type=Path)
 a=p.parse_args()
 if not a.train.exists() or not a.validation.exists() or not a.tokenizer.exists(): raise SystemExit("train, validation, and tokenizer paths must exist")
 rank,local,world,distributed=setup()
 try:
  random.seed(a.seed+rank); torch.manual_seed(a.seed+rank); device=torch.device("cuda",local) if torch.cuda.is_available() else torch.device("cpu")
  if device.type=="cuda": torch.cuda.set_device(local)
  tok=Tokenizer.from_file(str(a.tokenizer)); config=ProductionConfig(vocab_size=tok.get_vocab_size(),gradient_checkpointing=a.gradient_checkpointing,**PROFILES[a.profile]); config.validate()
  train=JsonlDataset(a.train,tok,config.context_size); val=JsonlDataset(a.validation,tok,config.context_size)
  ts=DistributedSampler(train,world,rank,shuffle=True) if distributed else None; vs=DistributedSampler(val,world,rank,shuffle=False) if distributed else None
  tl=DataLoader(train,batch_size=a.batch_size,sampler=ts,shuffle=ts is None,pin_memory=device.type=="cuda"); vl=DataLoader(val,batch_size=a.batch_size,sampler=vs,shuffle=False,pin_memory=device.type=="cuda")
  model=BobProductionLM(config).to(device)
  if a.init_from:
   state=torch.load(a.init_from,map_location=device,weights_only=False); source=state.get("config")
   if not isinstance(source,dict): raise SystemExit("--init-from is missing checkpoint architecture metadata")
   for key in PROFILES[a.profile]:
    if int(source.get(key,-1))!=PROFILES[a.profile][key]: raise SystemExit("--init-from architecture does not match selected profile")
   model.load_state_dict(state["model"],strict=True)
  if distributed: model=DDP(model,device_ids=[local] if device.type=="cuda" else None,broadcast_buffers=False)
  opt=torch.optim.AdamW(model.parameters(),lr=a.learning_rate,betas=(.9,.95),eps=1e-8,weight_decay=a.weight_decay); steps_epoch=max(1,math.ceil(len(tl)/max(1,a.grad_accum))); total=a.max_steps or max(1,a.epochs*steps_epoch)
  def lr_lambda(step):
   if step<a.warmup_steps:return max(1e-8,step/max(1,a.warmup_steps))
   progress=min(1,(step-a.warmup_steps)/max(1,total-a.warmup_steps)); return .1+.9*.5*(1+math.cos(math.pi*progress))
  sched=torch.optim.lr_scheduler.LambdaLR(opt,lr_lambda); amp=device.type=="cuda" and a.precision!="fp32"; dtype=torch.bfloat16 if a.precision=="bf16" else torch.float16; scaler=torch.amp.GradScaler("cuda",enabled=amp and a.precision=="fp16")
  step=0; start=0; best=float("inf")
  if a.resume:
   state=torch.load(a.resume,map_location=device,weights_only=False); unwrap(model).load_state_dict(state["model"]); opt.load_state_dict(state["optimizer"]); sched.load_state_dict(state["scheduler"]); step=int(state.get("step",0)); start=int(state.get("epoch",0)); best=float(state.get("best_validation_loss",best))
  if rank==0: print(json.dumps({"stage":a.stage,"profile":a.profile,"parameters":parameter_count(unwrap(model)),"device":str(device),"world_size":world,"total_steps":total}))
  opt.zero_grad(set_to_none=True); stop=False
  for epoch in range(start,a.epochs):
   if ts: ts.set_epoch(epoch)
   for micro,(x,y,_) in enumerate(tl):
    x,y=x.to(device),y.to(device); sync=(micro+1)%max(1,a.grad_accum)==0 or micro+1==len(tl); ctx=model.no_sync() if isinstance(model,DDP) and not sync else torch.enable_grad()
    with ctx:
     with torch.autocast(device_type=device.type,dtype=dtype,enabled=amp): logits=model(x); loss=nn.functional.cross_entropy(logits.reshape(-1,logits.size(-1)),y.reshape(-1),ignore_index=-100)/max(1,a.grad_accum)
     scaler.scale(loss).backward()
    if not sync: continue
    scaler.unscale_(opt); nn.utils.clip_grad_norm_(model.parameters(),1.0); scaler.step(opt); scaler.update(); opt.zero_grad(set_to_none=True); sched.step(); step+=1
    if rank==0 and (step==1 or step%20==0): print(json.dumps({"step":step,"stage":a.stage,"loss":float(loss.detach().cpu())*max(1,a.grad_accum),"lr":opt.param_groups[0]["lr"]}))
    if step%max(1,a.eval_every)==0:
     val_loss=evaluate(model,vl,device,amp,dtype,a.eval_batches)
     if distributed:
      t=torch.tensor([val_loss],device=device); dist.all_reduce(t); val_loss=float(t.item()/world)
     if rank==0:
      improved=val_loss<best; best=min(best,val_loss); save(a.output_dir/"latest.pt",model,opt,sched,step,epoch,config,a.tokenizer,best,a.stage)
      if improved: save(a.output_dir/"best.pt",model,opt,sched,step,epoch,config,a.tokenizer,best,a.stage)
      print(json.dumps({"step":step,"validation_loss":val_loss,"best_validation_loss":best}))
    elif rank==0 and step%max(1,a.save_every)==0: save(a.output_dir/"latest.pt",model,opt,sched,step,epoch,config,a.tokenizer,best,a.stage)
    if step>=total: stop=True; break
   if stop: break
  if rank==0:
   save(a.output_dir/"latest.pt",model,opt,sched,step,a.epochs,config,a.tokenizer,best,a.stage)
   (a.output_dir/"model.json").write_text(json.dumps({"model_id":"bob-production","stage":a.stage,"format":"bob-production-v2","parameters":parameter_count(unwrap(model)),"config":config.to_dict(),"tokenizer":str(a.tokenizer),"best_validation_loss":best,"step":step},indent=2)+"\n",encoding="utf-8")
 finally:
  if distributed and dist.is_initialized(): dist.destroy_process_group()

if __name__=="__main__": main()
