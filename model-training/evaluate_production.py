from __future__ import annotations

import argparse, json, math
from pathlib import Path
import torch
from tokenizers import Tokenizer
from production_model import BobProductionLM, ProductionConfig

ROLE_TOKENS={"system":"<|system|>","user":"<|user|>","assistant":"<|assistant|>"}

def load(path:Path,device:torch.device):
 state=torch.load(path,map_location=device,weights_only=False)
 config=ProductionConfig(**state["config"]); model=BobProductionLM(config).to(device); model.load_state_dict(state["model"],strict=True); model.eval(); return model,config

def format_messages(messages):
 parts=["<|bos|>"]
 for m in messages:
  if isinstance(m,dict) and m.get("role") in ROLE_TOKENS and isinstance(m.get("content"),str): parts.append(f"{ROLE_TOKENS[m['role']]}\n{m['content'].strip()}")
 parts.append("<|assistant|>\n"); return "\n".join(parts)

def main():
 p=argparse.ArgumentParser(description="Evaluate a trained BobAI production checkpoint on held-out loss and prompt smoke tests.")
 p.add_argument("--checkpoint",type=Path,required=True); p.add_argument("--tokenizer",type=Path,required=True); p.add_argument("--test",type=Path,default=Path("model-training/data/validation.jsonl")); p.add_argument("--prompts",type=Path,default=Path("model-training/eval/prompts.jsonl")); p.add_argument("--output",type=Path,default=Path("model-training/output/bob-production/evaluation.json")); p.add_argument("--batch-size",type=int,default=1); p.add_argument("--max-new-tokens",type=int,default=256); p.add_argument("--max-records",type=int,default=1000); p.add_argument("--device",choices=["auto","cpu","cuda"],default="auto")
 a=p.parse_args(); device=torch.device("cuda" if a.device=="auto" and torch.cuda.is_available() else a.device if a.device!="auto" else "cpu")
 if not a.checkpoint.exists() or not a.tokenizer.exists(): raise SystemExit("checkpoint and tokenizer must exist")
 model,config=load(a.checkpoint,device); tok=Tokenizer.from_file(str(a.tokenizer)); eos=tok.token_to_id("<|eos|>")
 total_loss=0.; records=0
 with a.test.open("r",encoding="utf-8") as f,torch.no_grad():
  for line in f:
   if records>=a.max_records: break
   if not line.strip(): continue
   row=json.loads(line); text=row.get("text") if isinstance(row.get("text"),str) else format_messages(row.get("messages",[])); ids=tok.encode(text,add_special_tokens=False).ids[:config.context_size+1]
   if len(ids)<2: continue
   x=torch.tensor([ids[:-1]],dtype=torch.long,device=device); y=torch.tensor([ids[1:]],dtype=torch.long,device=device); logits=model(x); total_loss+=float(torch.nn.functional.cross_entropy(logits.reshape(-1,logits.size(-1)),y.reshape(-1))); records+=1
 results=[]
 if a.prompts.exists():
  for line in a.prompts.read_text(encoding="utf-8").splitlines():
   if not line.strip(): continue
   row=json.loads(line); messages=row.get("messages",[]); ids=tok.encode(format_messages(messages),add_special_tokens=False).ids[-config.context_size:]; inp=torch.tensor([ids],dtype=torch.long,device=device)
   out=model.generate(inp,max_new_tokens=min(max(1,a.max_new_tokens),2048),temperature=.7,top_k=50,eos_id=eos); generated=out[0,inp.size(1):].tolist(); text=tok.decode(generated,skip_special_tokens=True).strip(); results.append({"id":row.get("id","unknown"),"response":text,"passed":bool(text)})
 report={"model_id":"bob-production","checkpoint":str(a.checkpoint),"device":str(device),"parameters":sum(p.numel() for p in model.parameters()),"test_examples":records,"test_loss":total_loss/max(1,records),"perplexity":math.exp(min(20,total_loss/max(1,records))),"prompt_passed":sum(bool(x["passed"]) for x in results),"prompt_total":len(results),"results":results}
 a.output.parent.mkdir(parents=True,exist_ok=True); a.output.write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n",encoding="utf-8"); print(json.dumps(report,indent=2,ensure_ascii=False))

if __name__=="__main__": main()
