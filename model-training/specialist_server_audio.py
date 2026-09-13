from __future__ import annotations
import argparse, base64, io, json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import torch
from specialist_server import load, ids, image_tensor, infer as base_infer, SPECIALISTS
from audio_features import wav_mel


def infer(kind, model, payload):
    if kind == "asr" and "audioBase64" in payload:
        audio = base64.b64decode(payload["audioBase64"], validate=True)
        features, _ = wav_mel(audio)
        with torch.inference_mode():
            logits = model(features.unsqueeze(0))[0]
            tokens = logits.argmax(-1).tolist()
        text = bytes(max(0, min(255, token - 1)) for token in tokens if 0 < token <= 256).decode("utf-8", "ignore")
        return {"kind": kind, "model": "Echo", "text": text}
    return base_infer(kind, model, payload)

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): return
    def do_GET(self):
        if self.path != "/health": self.send_error(404); return
        self.send_json(200, {"status":"ok","kind":self.server.kind})
    def do_POST(self):
        if self.path != "/infer": self.send_error(404); return
        if self.headers.get("authorization") != f"Bearer {self.server.token}": self.send_error(401); return
        try:
            length=int(self.headers.get("content-length","0"))
            if length<0 or length>16*1024*1024: raise ValueError("body too large")
            self.send_json(200,infer(self.server.kind,self.server.model,json.loads(self.rfile.read(length))))
        except Exception as exc: self.send_json(400,{"error":str(exc)[:500]})
    def send_json(self,status,value):
        data=json.dumps(value,separators=(",",":")).encode(); self.send_response(status); self.send_header("content-type","application/json"); self.send_header("content-length",str(len(data))); self.send_header("cache-control","no-store"); self.end_headers(); self.wfile.write(data)

def main():
    p=argparse.ArgumentParser(); p.add_argument("kind",choices=sorted(SPECIALISTS)); p.add_argument("--model",required=True); p.add_argument("--host",default="127.0.0.1"); p.add_argument("--port",type=int,required=True); p.add_argument("--token",required=True); a=p.parse_args(); server=ThreadingHTTPServer((a.host,a.port),Handler); server.kind=a.kind; server.model=load(a.kind,Path(a.model)); server.token=a.token; print(json.dumps({"status":"ready","kind":a.kind,"port":a.port}),flush=True); server.serve_forever()
if __name__=="__main__": main()
