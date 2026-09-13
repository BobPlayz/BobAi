from __future__ import annotations

import argparse, json, math, wave
from pathlib import Path

import torch
from PIL import Image

from specialist_models import VOCAB_SIZE


def ids(text: str, length: int = 512):
    raw = list(text.encode("utf-8")[: length - 2]); return torch.tensor(raw + [257], dtype=torch.long)


def wav_to_mel(path: Path, n_mels=80, n_fft=512, hop=160):
    with wave.open(str(path), "rb") as f:
        channels, width, rate = f.getnchannels(), f.getsampwidth(), f.getframerate(); raw = f.readframes(f.getnframes())
    if width != 2: raise ValueError(f"{path}: only PCM16 WAV is supported")
    audio = torch.frombuffer(bytearray(raw), dtype=torch.int16).float().view(-1, channels).mean(1) / 32768.0
    if audio.numel() < n_fft: audio = torch.nn.functional.pad(audio, (0, n_fft - audio.numel()))
    spec = torch.stft(audio, n_fft=n_fft, hop_length=hop, win_length=n_fft, window=torch.hann_window(n_fft), return_complex=True).abs().pow(2)
    freqs = torch.linspace(0, rate / 2, n_fft // 2 + 1)
    mel_low, mel_high = 1127 * math.log1p(20 / 700), 1127 * math.log1p((rate / 2) / 700)
    hz = 700 * (torch.exp(torch.linspace(mel_low, mel_high, n_mels + 2) / 1127) - 1)
    bins = torch.floor((n_fft + 1) * hz / rate).long().clamp(0, n_fft // 2)
    bank = torch.zeros(n_mels, n_fft // 2 + 1)
    for m in range(1, n_mels + 1):
        left, center, right = int(bins[m - 1]), int(bins[m]), int(bins[m + 1])
        if center > left: bank[m - 1, left:center] = torch.arange(left, center) / (center - left)
        if right > center: bank[m - 1, center:right] = (right - torch.arange(center, right)) / (right - center)
    return torch.log(bank @ spec + 1e-5), rate


def load_jsonl(path: Path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def save(path: Path, payload: dict[str, torch.Tensor]):
    path.parent.mkdir(parents=True, exist_ok=True); torch.save(payload, path); print(json.dumps({"output": str(path), "samples": next(iter(payload.values())).shape[0]}))


def build(kind: str, source: Path, output: Path):
    rows = load_jsonl(source)
    if kind == "embed":
        a,b,y=[],[],[]
        for row in rows: a.append(ids(row["text_a"])); b.append(ids(row["text_b"])); y.append(float(row["label"]))
        save(output,{"ids_a":torch.nn.utils.rnn.pad_sequence(a,batch_first=True,padding_value=256),"ids_b":torch.nn.utils.rnn.pad_sequence(b,batch_first=True,padding_value=256),"label":torch.tensor(y)})
    elif kind == "reranker":
        raise ValueError("reranker dataset requires numeric query/document vectors; prepare those from your eligible embedding dataset before training")
    elif kind in {"tts","image"}:
        ids_list=[]; targets=[]
        for row in rows:
            ids_list.append(ids(row["text"] if "text" in row else row["caption"]))
            if kind == "image": targets.append(torch.tensor(list(Image.open(row["image"]).convert("RGB").resize((32,32)).getdata()),dtype=torch.float32).view(32,32,3).permute(2,0,1)/255)
            else: targets.append(torch.load(row["mel"],map_location="cpu",weights_only=True) if str(row["mel"]).endswith(".pt") else wav_to_mel(Path(row["audio"]))[0])
        key="image" if kind=="image" else "mel"; save(output,{"ids":torch.nn.utils.rnn.pad_sequence(ids_list,batch_first=True,padding_value=256),key:torch.stack(targets)})
    elif kind == "vision":
        images=[]; labels=[]
        for row in rows:
            image=torch.tensor(list(Image.open(row["image"]).convert("RGB").resize((64,64)).getdata()),dtype=torch.float32).view(64,64,3).permute(2,0,1)/255; images.append(image); labels.append(torch.tensor(row["label"],dtype=torch.float32))
        save(output,{"image":torch.stack(images),"label":torch.stack(labels)})
    elif kind == "asr":
        mels=[]; targets=[]; input_lengths=[]; target_lengths=[]
        for row in rows:
            m,_=wav_to_mel(Path(row["audio"])); t=ids(row["text"])[:-1]; mels.append(m); targets.append(t); input_lengths.append(max(1,m.shape[-1]//4)); target_lengths.append(len(t))
        max_t=max(x.shape[-1] for x in mels); padded=[torch.nn.functional.pad(x,(0,max_t-x.shape[-1])) for x in mels]; save(output,{"mel":torch.stack(padded),"targets":torch.cat(targets),"input_lengths":torch.tensor(input_lengths),"target_lengths":torch.tensor(target_lengths)})
    else: raise ValueError(f"unknown specialist: {kind}")


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description="Prepare local eligible datasets for BobAI specialist training"); parser.add_argument("kind",choices=["embed","reranker","vision","asr","tts","image"]); parser.add_argument("--input",type=Path,required=True); parser.add_argument("--output",type=Path,required=True); args=parser.parse_args(); build(args.kind,args.input,args.output)
