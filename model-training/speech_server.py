from __future__ import annotations
import argparse,base64,json
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import torch
from specialist_server import SPECIALISTS,load
from audio_features import griffin_lim,wav_bytes

def synth(model,text,frames):
 raw=text.encode("utf-8")[:510]; ids=torch.tensor([[*raw,257]],dtype=torch.long)
 with torch.inference_mode(): mel=model(ids,frames)[0]
 return {"kind":"tts","model":"Echo","audioBase64":base64.b64encode(wav_bytes(griffin_lim(mel))).decode("ascii"),"mimeType":"audio/wav","sampleRate":22050}
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args): return
 def do_GET(self):
  if self.path!="/health": self.send_error(404); return
  self.send_json(200,{"status":"ok","kind":"tts"})
 def do_POST(self):
  if self.path!="/infer": self.send_error(404); return
  if self.headers.get("authorization")!=f"Bearer {self.server.token}": self.send_error(401); return
  try:
   n=int(self.headers.get("content-length","0"));
   if n<0 or n>4*1024*1024: raise ValueError("body too large")
   p=json.loads(self.rfile.read(n)); self.send_json(200,synth(self.server.model,str(p.get("text","")),max(8,min(512,int(p.get("frames",64))))))
  except Exception as exc: self.send_json(400,{"error":str(exc)[:500]})
 def send_json(self,status,value):
  data=json.dumps(value,separators=(",",":")).encode(); self.send_response(status); self.send_header("content-type","application/json"); self.send_header("content-length",str(len(data))); self.send_header("cache-control","no-store"); self.end_headers(); self.wfile.write(data)
def main():
 p=argparse.ArgumentParser(); p.add_argument("--model",required=True); p.add_argument("--host",default="127.0.0.1"); p.add_argument("--port",type=int,required=True); p.add_argument("--token",required=True); a=p.parse_args(); server=ThreadingHTTPServer((a.host,a.port),Handler); server.model=load("tts",Path(a.model)); server.token=a.token; print(json.dumps({"status":"ready","kind":"tts","port":a.port}),flush=True); server.serve_forever()
if __name__=="__main__": main()
