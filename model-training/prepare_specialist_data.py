from __future__ import annotations

import argparse
import json
import math
import wave
from pathlib import Path

import torch
from PIL import Image

ASR_OFFSET = 1
MAX_IMAGE_PIXELS = 1_000_000
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


def ids(text, length=512):
    raw = list(text.encode("utf-8")[:length - 2]); return torch.tensor(raw + [257], dtype=torch.long)


def asr_ids(text, length=512):
    raw = list(text.encode("utf-8")[:length - 1]); return torch.tensor([byte + ASR_OFFSET for byte in raw], dtype=torch.long)


def wav_to_mel(path, n_mels=80, n_fft=512, hop=160):
    with wave.open(str(path), "rb") as f:
        channels, width, rate = f.getnchannels(), f.getsampwidth(), f.getframerate(); raw = f.readframes(f.getnframes())
    if width != 2: raise ValueError(f"{path}: only PCM16 WAV is supported")
    audio = torch.frombuffer(bytearray(raw), dtype=torch.int16).float().view(-1, channels).mean(1) / 32768.0
    if audio.numel() < n_fft: audio = torch.nn.functional.pad(audio, (0, n_fft - audio.numel()))
    spec = torch.stft(audio, n_fft=n_fft, hop_length=hop, win_length=n_fft, window=torch.hann_window(n_fft), return_complex=True).abs().pow(2)
    low, high = 20.0, rate / 2; lm, hm = 1127 * math.log1p(low / 700), 1127 * math.log1p(high / 700); hz = 700 * (torch.exp(torch.linspace(lm, hm, n_mels + 2) / 1127) - 1); bins = torch.floor((n_fft + 1) * hz / rate).long().clamp(0, n_fft // 2); bank = torch.zeros(n_mels, n_fft // 2 + 1)
    for m in range(1, n_mels + 1):
        l, c, r = int(bins[m - 1]), int(bins[m]), int(bins[m + 1])
        if c > l: bank[m - 1, l:c] = torch.arange(l, c) / (c - l)
        if r > c: bank[m - 1, c:r] = (r - torch.arange(c, r)) / (r - c)
    return torch.log(bank @ spec + 1e-5), rate


def load_jsonl(path): return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def save(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True); torch.save(payload, path); print(json.dumps({"output": str(path), "samples": next(iter(payload.values())).shape[0]}))


def asr_output_length(frames): return (frames + 1) // 2


def build(kind, source, output):
    rows = load_jsonl(source)
    if not rows: raise ValueError("input dataset is empty")
    if kind == "embed":
        a, b, y = [], [], []
        for row in rows: a.append(ids(row["text_a"])); b.append(ids(row["text_b"])); y.append(float(row["label"]))
        pa = torch.nn.utils.rnn.pad_sequence(a, batch_first=True, padding_value=256); pb = torch.nn.utils.rnn.pad_sequence(b, batch_first=True, padding_value=256); save(output, {"ids_a": pa, "ids_b": pb, "mask_a": pa.ne(256), "mask_b": pb.ne(256), "label": torch.tensor(y)})
    elif kind == "reranker":
        raise ValueError("reranker training needs numeric query/document vectors; build those from your eligible Vector dataset first")
    elif kind in {"tts", "image"}:
        ids_list, targets = [], []
        for row in rows:
            ids_list.append(ids(row["text"] if "text" in row else row["caption"]))
            if kind == "image":
                with Image.open(row["image"]) as image:
                    image = image.convert("RGB").resize((32, 32)); targets.append(torch.tensor(list(image.getdata()), dtype=torch.float32).view(32, 32, 3).permute(2, 0, 1) / 255)
            else:
                mel = torch.load(row["mel"], map_location="cpu", weights_only=True) if str(row["mel"]).endswith(".pt") else wav_to_mel(Path(row["audio"]))[0]
                if not isinstance(mel, torch.Tensor) or mel.ndim != 2 or mel.shape[0] != 80: raise ValueError("TTS mel must have shape [80,frames]")
                targets.append(mel.float())
        if kind == "image":
            save(output, {"ids": torch.nn.utils.rnn.pad_sequence(ids_list, batch_first=True, padding_value=256), "image": torch.stack(targets)})
        else:
            padded_mel = torch.nn.utils.rnn.pad_sequence([mel.transpose(0, 1) for mel in targets], batch_first=True).transpose(1, 2)
            save(output, {"ids": torch.nn.utils.rnn.pad_sequence(ids_list, batch_first=True, padding_value=256), "mel": padded_mel})
    elif kind == "vision":
        images, labels = [], []
        for row in rows:
            with Image.open(row["image"]) as image:
                image = image.convert("RGB").resize((64, 64)); images.append(torch.tensor(list(image.getdata()), dtype=torch.float32).view(64, 64, 3).permute(2, 0, 1) / 255)
            labels.append(torch.tensor(row["label"], dtype=torch.float32))
        save(output, {"image": torch.stack(images), "label": torch.stack(labels)})
    elif kind == "asr":
        mels, targets, input_lengths, target_lengths = [], [], [], []
        for row in rows:
            m, _ = wav_to_mel(Path(row["audio"])); t = asr_ids(row["text"]); effective = asr_output_length(m.shape[-1])
            if len(t) > effective: raise ValueError(f"ASR sample target is too long for its audio: {row['audio']} ({len(t)} tokens > {effective} output frames)")
            mels.append(m); targets.append(t); input_lengths.append(effective); target_lengths.append(len(t))
        max_t = max(x.shape[-1] for x in mels); padded = [torch.nn.functional.pad(x, (0, max_t - x.shape[-1])) for x in mels]; save(output, {"mel": torch.stack(padded), "targets": torch.cat(targets), "input_lengths": torch.tensor(input_lengths), "target_lengths": torch.tensor(target_lengths)})
    else: raise ValueError(f"unknown specialist: {kind}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prepare local eligible datasets for BobAI specialist training"); parser.add_argument("kind", choices=["embed", "reranker", "vision", "asr", "tts", "image"]); parser.add_argument("--input", type=Path, required=True); parser.add_argument("--output", type=Path, required=True); args = parser.parse_args(); build(args.kind, args.input, args.output)
