from __future__ import annotations
import argparse,json,struct
from datetime import datetime,timezone
from pathlib import Path
import torch
from native_model import ASSISTANT,BOS,EOS,SYSTEM,USER,BobNativeLM,encode_text,role_token
ROOT=Path(__file__).resolve().parent

def load_native(path:Path):
    raw=path.read_bytes()
    if raw[:8]!=b"BOBAI002": raise SystemExit("invalid native model file; expected BOBAI002")
    header_len=struct.unpack("<I",raw[8:12])[0]; header=json.loads(raw[12:12+header_len].decode("utf-8")); data_start=(12+header_len+3)&~3
    model=BobNativeLM(int(header["context_size"]),int(header["d_model"]),int(header["n_heads"]),int(header["ffn_dim"]),int(header["n_layers"])); state=model.state_dict()
    for spec in header["tensors"]:
        name=spec["name"]
        if name not in state: raise SystemExit(f"model tensor {name} is not supported by this runtime")
        start=data_start+int(spec["offset"]); count=int(spec["count"]); values=torch.frombuffer(memoryview(raw)[start:start+count*4],dtype=torch.float32).clone().reshape(tuple(spec["shape"]))
        if tuple(values.shape)!=tuple(state[name].shape): raise SystemExit(f"tensor shape mismatch for {name}: {tuple(values.shape)} != {tuple(state[name].shape)}")
        state[name]=values
    model.load_state_dict(state); model.eval(); return model,header

def prompt_ids(messages):
    ids=[BOS]
    for message in messages: ids.append(role_token(message["role"])); ids.extend(encode_text(message["content"]))
    ids.append(ASSISTANT); return ids

def generate(model,messages,max_new_tokens=160):
    ids=prompt_ids(messages); prompt_length=len(ids); context=model.context_size
    with torch.no_grad():
        for _ in range(max_new_tokens):
            inp=torch.tensor([ids[-context:]],dtype=torch.long); logits=model(inp)[0,-1].clone()
            for token in (BOS,USER,SYSTEM,ASSISTANT): logits[token]=-1e9
            next_token=int(torch.argmax(logits).item())
            if next_token==EOS: break
            ids.append(next_token)
    return bytes(token for token in ids[prompt_length:] if 0<=token<256).decode("utf-8",errors="ignore").strip()

def main():
    parser=argparse.ArgumentParser(description="Evaluate a BobAI native model without an external inference server."); parser.add_argument("--model",type=Path,default=ROOT/"output/bob-0.2-native/model.bob"); parser.add_argument("--output",type=Path,default=ROOT/"output/evaluation.json"); parser.add_argument("--max-new-tokens",type=int,default=160); args=parser.parse_args()
    if args.max_new_tokens<1 or args.max_new_tokens>4096: raise SystemExit("max-new-tokens is outside the supported range")
    if not args.model.exists(): raise SystemExit("Train a native Bob model first or pass --model.")
    model,header=load_native(args.model); prompts=[json.loads(line) for line in (ROOT/"eval/prompts.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]; results=[]
    for prompt in prompts:
        response=generate(model,prompt["messages"],args.max_new_tokens); results.append({"id":prompt["id"],"response":response,"passed":bool(response)})
    passed=sum(1 for item in results if item["passed"]); report={"model_id":header.get("model_id","bob-0.2-native"),"format":header.get("format"),"evaluated_at":datetime.now(timezone.utc).isoformat(),"passed":passed,"total":len(results),"pass_rate":passed/len(results) if results else 0.0,"results":results}; args.output.parent.mkdir(parents=True,exist_ok=True); args.output.write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n",encoding="utf-8"); print(json.dumps(report,indent=2,ensure_ascii=False))

if __name__=="__main__": main()
