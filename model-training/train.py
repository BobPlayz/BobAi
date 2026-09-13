from __future__ import annotations

import argparse
import json
import math
import random
import struct
from pathlib import Path

import torch
from torch import nn
import torch.nn.functional as F

BOS, EOS, USER, ASSISTANT, SYSTEM = 256, 257, 258, 259, 260
VOCAB_SIZE = 261
DEFAULT_CONTEXT = 512
DEFAULT_D_MODEL = 96
DEFAULT_HEADS = 4
DEFAULT_FFN = 384
DEFAULT_LAYERS = 4


def encode_text(text: str) -> list[int]: return list(text.encode("utf-8"))
def role_token(role: str) -> int: return {"user": USER, "assistant": ASSISTANT, "system": SYSTEM}.get(role, USER)
def encode_messages(messages: list[dict[str, str]]) -> list[int]:
    ids = [BOS]
    for message in messages:
        ids.append(role_token(message["role"])); ids.extend(encode_text(message["content"]))
    ids.append(EOS); return ids


class BobBlock(nn.Module):
    def __init__(self, d_model: int, n_heads: int, ffn_dim: int) -> None:
        super().__init__()
        if d_model % n_heads: raise ValueError("d_model must be divisible by n_heads")
        self.ln1 = nn.LayerNorm(d_model); self.qkv = nn.Linear(d_model, 3 * d_model); self.proj = nn.Linear(d_model, d_model)
        self.ln2 = nn.LayerNorm(d_model); self.fc1 = nn.Linear(d_model, ffn_dim); self.fc2 = nn.Linear(ffn_dim, d_model); self.n_heads = n_heads; self.d_model = d_model
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        y = self.ln1(x); q, k, v = self.qkv(y).chunk(3, dim=-1); batch, length, _ = q.shape; head_dim = self.d_model // self.n_heads
        q = q.view(batch, length, self.n_heads, head_dim).transpose(1, 2); k = k.view(batch, length, self.n_heads, head_dim).transpose(1, 2); v = v.view(batch, length, self.n_heads, head_dim).transpose(1, 2)
        scores = (q @ k.transpose(-2, -1)) / math.sqrt(head_dim); mask = torch.triu(torch.ones(length, length, device=x.device, dtype=torch.bool), diagonal=1); scores = scores.masked_fill(mask, torch.finfo(scores.dtype).min)
        attended = scores.softmax(dim=-1) @ v; attended = attended.transpose(1, 2).contiguous().view(batch, length, self.d_model); x = x + self.proj(attended); return x + self.fc2(F.gelu(self.fc1(self.ln2(x))))


class BobNativeLM(nn.Module):
    def __init__(self, context_size: int = DEFAULT_CONTEXT, d_model: int = DEFAULT_D_MODEL, n_heads: int = DEFAULT_HEADS, ffn_dim: int = DEFAULT_FFN, n_layers: int = DEFAULT_LAYERS) -> None:
        super().__init__(); self.context_size=context_size; self.d_model=d_model; self.n_heads=n_heads; self.ffn_dim=ffn_dim; self.n_layers=n_layers
        self.tok=nn.Embedding(VOCAB_SIZE,d_model); self.pos=nn.Embedding(context_size,d_model); self.blocks=nn.ModuleList(BobBlock(d_model,n_heads,ffn_dim) for _ in range(n_layers)); self.ln=nn.LayerNorm(d_model); self.head=nn.Linear(d_model,VOCAB_SIZE)
    def forward(self,input_ids:torch.Tensor)->torch.Tensor:
        _,length=input_ids.shape
        if length>self.context_size: raise ValueError("sequence exceeds configured context")
        positions=torch.arange(length,device=input_ids.device); x=self.tok(input_ids)+self.pos(positions)
        for block in self.blocks: x=block(x)
        return self.head(self.ln(x))


def load_rows(path: Path) -> list[list[int]]:
    rows=[]
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip(): continue
        try: row=json.loads(line)
        except json.JSONDecodeError: continue
        messages=row.get("messages")
        if isinstance(messages,list):
            normalized=[{"role":m["role"],"content":m["content"]} for m in messages if isinstance(m,dict) and m.get("role") in {"system","user","assistant"} and isinstance(m.get("content"),str)]
            if normalized: rows.append(encode_messages(normalized))
    return rows


def make_batch(rows,device,context_size):
    inputs=[];targets=[]
    for sequence in rows:
        sequence=sequence[:context_size+1]; x,y=sequence[:-1],sequence[1:]; pad=context_size-len(x); inputs.append(x+[BOS]*pad); targets.append(y+[-100]*pad)
    return torch.tensor(inputs,dtype=torch.long,device=device),torch.tensor(targets,dtype=torch.long,device=device)


def export_model(model,output,train_count,validation_count,seed):
    state=model.state_dict(); tensors=[]; payloads=[]; offset=0
    for name,tensor in state.items():
        raw=tensor.detach().cpu().contiguous().numpy().astype("float32").tobytes(); tensors.append({"name":name,"shape":list(tensor.shape),"offset":offset,"count":tensor.numel()}); payloads.append(raw); offset+=len(raw)
    header={"format":"bobai-native-transformer","version":2,"model_id":"bob-0.2-native","vocab_size":VOCAB_SIZE,"context_size":model.context_size,"d_model":model.d_model,"n_heads":model.n_heads,"ffn_dim":model.ffn_dim,"n_layers":model.n_layers,"tokenizer":"utf8-byte-v1","seed":seed,"train_examples":train_count,"validation_examples":validation_count,"tensors":tensors}
    header_bytes=json.dumps(header,separators=(",",":")).encode("utf-8"); prefix=b"BOBAI002"+struct.pack("<I",len(header_bytes))+header_bytes; padding=b"\0"*((4-(len(prefix)%4))%4); output.parent.mkdir(parents=True,exist_ok=True); output.write_bytes(prefix+padding+b"".join(payloads)); (output.parent/"model.json").write_text(json.dumps(header,indent=2)+"\n",encoding="utf-8")


def validate_arch(context_size,d_model,n_heads,ffn_dim,n_layers):
    if not 64<=context_size<=2048 or not 32<=d_model<=2048 or not 1<=n_heads<=32 or d_model%n_heads or not 64<=ffn_dim<=8192 or not 1<=n_layers<=32: raise SystemExit("model architecture is outside the supported range")


def evaluate(model,rows,device,context_size,batch_size):
    model.eval(); losses=[]
    with torch.no_grad():
        for start in range(0,len(rows),batch_size):
            x,y=make_batch(rows[start:start+batch_size],device,context_size); losses.append(float(F.cross_entropy(model(x).reshape(-1,VOCAB_SIZE),y.reshape(-1),ignore_index=-100).cpu()))
    return sum(losses)/len(losses)


def train(train_path,validation_path,output,epochs=40,batch_size=4,learning_rate=0.001,seed=42,device_name="auto",context_size=DEFAULT_CONTEXT,d_model=DEFAULT_D_MODEL,n_heads=DEFAULT_HEADS,ffn_dim=DEFAULT_FFN,n_layers=DEFAULT_LAYERS,grad_accum=1,checkpoint_every=10,resume=None,patience=0,min_delta=0.0):
    if not train_path.exists() or not validation_path.exists(): raise SystemExit("Run prepare_dataset.py first so train.jsonl and validation.jsonl exist.")
    if epochs<1 or epochs>100000 or batch_size<1 or batch_size>128 or grad_accum<1 or grad_accum>1024: raise SystemExit("training limits are invalid")
    validate_arch(context_size,d_model,n_heads,ffn_dim,n_layers); random.seed(seed); torch.manual_seed(seed)
    if device_name=="cuda" and not torch.cuda.is_available(): raise SystemExit("CUDA was requested but is not available")
    device=torch.device("cuda" if device_name=="cuda" or (device_name=="auto" and torch.cuda.is_available()) else "cpu"); train_rows=load_rows(train_path); validation_rows=load_rows(validation_path)
    if not train_rows or not validation_rows: raise SystemExit("training and validation datasets must both contain eligible examples")
    model=BobNativeLM(context_size,d_model,n_heads,ffn_dim,n_layers).to(device); optimizer=torch.optim.AdamW(model.parameters(),lr=learning_rate,weight_decay=0.01); scheduler=torch.optim.lr_scheduler.CosineAnnealingLR(optimizer,max(1,epochs)); start_epoch=0; best_val=float("inf"); stale=0
    if resume:
        checkpoint=Path(resume)
        if not checkpoint.exists(): raise SystemExit(f"checkpoint not found: {checkpoint}")
        state=torch.load(checkpoint,map_location=device,weights_only=False); expected=state.get("architecture",{}); current={"context_size":context_size,"d_model":d_model,"n_heads":n_heads,"ffn_dim":ffn_dim,"n_layers":n_layers}
        if expected and expected!=current: raise SystemExit(f"checkpoint architecture mismatch: {expected} != {current}")
        model.load_state_dict(state["model"]); optimizer.load_state_dict(state["optimizer"]); scheduler.load_state_dict(state["scheduler"]); start_epoch=int(state.get("epoch",0)); best_val=float(state.get("best_validation_loss",float("inf"))); stale=int(state.get("stale",0)); seed=int(state.get("seed",seed)); print(json.dumps({"resumed_from":str(checkpoint),"epoch":start_epoch,"best_validation_loss":best_val}))
    architecture={"context_size":context_size,"d_model":d_model,"n_heads":n_heads,"ffn_dim":ffn_dim,"n_layers":n_layers}; checkpoint_path=Path(output).with_suffix(".checkpoint.pt")
    for epoch in range(start_epoch,epochs):
        model.train(); random.shuffle(train_rows); optimizer.zero_grad(set_to_none=True); losses=[]
        for batch_index,start in enumerate(range(0,len(train_rows),batch_size)):
            x,y=make_batch(train_rows[start:start+batch_size],device,context_size); loss=F.cross_entropy(model(x).reshape(-1,VOCAB_SIZE),y.reshape(-1),ignore_index=-100)/grad_accum; loss.backward(); losses.append(float(loss.detach().cpu()))
            if (batch_index+1)%grad_accum==0 or start+batch_size>=len(train_rows): torch.nn.utils.clip_grad_norm_(model.parameters(),1.0); optimizer.step(); optimizer.zero_grad(set_to_none=True)
        val_loss=evaluate(model,validation_rows,device,context_size,batch_size); scheduler.step(); improved=val_loss < best_val-min_delta
        if improved: best_val=val_loss; stale=0; torch.save({"epoch":epoch+1,"model":model.state_dict(),"optimizer":optimizer.state_dict(),"scheduler":scheduler.state_dict(),"best_validation_loss":best_val,"stale":stale,"seed":seed,"architecture":architecture},checkpoint_path)
        else: stale+=1
        if epoch==start_epoch or (epoch+1)%max(1,epochs//20)==0 or improved: print(json.dumps({"epoch":epoch+1,"train_loss":sum(losses)/len(losses)*grad_accum,"validation_loss":val_loss,"best_validation_loss":best_val,"learning_rate":optimizer.param_groups[0]["lr"],"checkpoint":str(checkpoint_path) if checkpoint_path.exists() else None}))
        if patience and stale>=patience: print(json.dumps({"early_stop":True,"epoch":epoch+1,"patience":patience})); break
    export_model(model,Path(output),len(train_rows),len(validation_rows),seed); result={"model":str(output),"device":str(device),"parameters":sum(p.numel() for p in model.parameters()),"context_size":context_size,"d_model":d_model,"n_heads":n_heads,"ffn_dim":ffn_dim,"n_layers":n_layers,"best_validation_loss":best_val,"checkpoint":str(checkpoint_path)}; print(json.dumps(result)); return result


def main():
    parser=argparse.ArgumentParser(description="Train Bob-0.2-native from scratch with resumable checkpoints."); parser.add_argument("--train",type=Path,default=Path("model-training/data/train.jsonl")); parser.add_argument("--validation",type=Path,default=Path("model-training/data/validation.jsonl")); parser.add_argument("--output",type=Path,default=Path("model-training/output/bob-0.2-native/model.bob")); parser.add_argument("--epochs",type=int,default=40); parser.add_argument("--batch-size",type=int,default=4); parser.add_argument("--learning-rate",type=float,default=0.001); parser.add_argument("--seed",type=int,default=42); parser.add_argument("--device",choices=["auto","cpu","cuda"],default="auto"); parser.add_argument("--context-size",type=int,default=DEFAULT_CONTEXT); parser.add_argument("--d-model",type=int,default=DEFAULT_D_MODEL); parser.add_argument("--n-heads",type=int,default=DEFAULT_HEADS); parser.add_argument("--ffn-dim",type=int,default=DEFAULT_FFN); parser.add_argument("--n-layers",type=int,default=DEFAULT_LAYERS); parser.add_argument("--grad-accum",type=int,default=1); parser.add_argument("--checkpoint-every",type=int,default=10,help="reserved for compatibility; best checkpoints are saved whenever validation improves"); parser.add_argument("--resume",default=None); parser.add_argument("--patience",type=int,default=0); parser.add_argument("--min-delta",type=float,default=0.0); args=parser.parse_args(); train(**vars(args))

if __name__=="__main__": main()
