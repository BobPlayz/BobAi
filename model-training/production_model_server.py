from __future__ import annotations
import argparse,json
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from typing import Any
import torch
from tokenizers import Tokenizer
from production_model import BobProductionLM,ProductionConfig
ROLE_TOKENS={"system":"<|system|>","user":"<|user|>","assistant":"<|assistant|>"}; MAX_BODY=4*1024*1024

def format_messages(messages):
 parts=["<|bos|>"]
 for m in messages[-100:]:
  if isinstance(m,dict) and m.get("role") in ROLE_TOKENS and isinstance(m.get("content"),str): parts.append(f"{ROLE_TOKENS[m['role']]}\n{m['content'][:100000]}")
 parts.append("<|assistant|>\n"); return "\n".join(parts)
class Runtime:
 def __init__(self,checkpoint,tokenizer_path,device_name):
  self.tokenizer=Tokenizer.from_file(str(tokenizer_path)); self.device=torch.device("cuda" if device_name=="auto" and torch.cuda.is_available() else device_name if device_name!="auto" else "cpu"); state=torch.load(checkpoint,map_location=self.device,weights_only=False); self.config=ProductionConfig(**state["config"]); self.config.gradient_checkpointing=False; self.model=BobProductionLM(self.config).to(self.device); self.model.load_state_dict(state["model"],strict=True); self.model.eval(); self.eos_id=self.tokenizer.token_to_id("<|eos|>")
 @torch.inference_mode()
 def infer(self,messages,max_tokens,temperature,top_k):
  ids=self.tokenizer.encode(format_messages(messages),add_special_tokens=False).ids[-self.config.context_size:]; inp=torch.tensor([ids],dtype=torch.long,device=self.device); out=self.model.generate(inp,max_new_tokens=min(max(1,max_tokens),2048),temperature=min(max(temperature,0),2),top_k=min(max(top_k,1),512),eos_id=self.eos_id); generated=out[0,inp.size(1):].tolist(); return {"content":self.tokenizer.decode(generated,skip_special_tokens=True).strip(),"model":"bob-production","tokens":len(generated)}
def handler(runtime,token):
 class Handler(BaseHTTPRequestHandler):
  def _json(self,status,value):
   body=json.dumps(value,ensure_ascii=False).encode(); self.send_response(status); self.send_header("content-type","application/json"); self.send_header("content-length",str(len(body))); self.end_headers(); self.wfile.write(body)
  def _authorized(self): return self.headers.get("authorization")==f"Bearer {token}"
  def do_GET(self):
   if self.path!="/health": return self._json(404,{"error":"not found"})
   return self._json(200,{"ready":True,"model":"bob-production","device":str(runtime.device),"context_size":runtime.config.context_size})
  def do_POST(self):
   if self.path!="/infer": return self._json(404,{"error":"not found"})
   if not self._authorized(): return self._json(401,{"error":"unauthorized"})
   try:
    length=int(self.headers.get("content-length","0"));
    if length<=0 or length>MAX_BODY:return self._json(413,{"error":"request too large"})
    payload=json.loads(self.rfile.read(length).decode()); messages=payload.get("messages")
    if not isinstance(messages,list) or not messages:return self._json(400,{"error":"messages are required"})
    return self._json(200,runtime.infer(messages,int(payload.get("max_tokens",768)),float(payload.get("temperature",.7)),int(payload.get("top_k",50))))
   except Exception as exc:return self._json(500,{"error":str(exc)[:2000]})
  def log_message(self,*_args): return
 return Handler
def main():
 p=argparse.ArgumentParser(description="Serve a trained BobAI production checkpoint on localhost."); p.add_argument("--checkpoint",type=Path); p.add_argument("--tokenizer",type=Path,default=Path("model-training/output/bob-production/tokenizer.json")); p.add_argument("--host",default="127.0.0.1"); p.add_argument("--port",type=int,default=39850); p.add_argument("--token",required=True); p.add_argument("--device",choices=["auto","cpu","cuda"],default="auto"); a=p.parse_args()
 if a.host not in {"127.0.0.1","localhost"}: raise SystemExit("production model server must bind to localhost")
 if a.checkpoint is None:
  best=Path("model-training/output/bob-production/best.pt"); latest=Path("model-training/output/bob-production/latest.pt"); a.checkpoint=best if best.exists() else latest
 if not a.checkpoint.exists(): raise SystemExit("no trained production checkpoint found; run the training pipeline first")
 runtime=Runtime(a.checkpoint,a.tokenizer,a.device); ThreadingHTTPServer((a.host,a.port),handler(runtime,a.token)).serve_forever()
if __name__=="__main__": main()
