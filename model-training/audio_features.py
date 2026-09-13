from __future__ import annotations
import io, math, wave
import torch

def wav_mel(data: bytes, n_mels: int = 80, n_fft: int = 512, hop: int = 160):
    with wave.open(io.BytesIO(data), "rb") as f:
        channels, width, rate, raw = f.getnchannels(), f.getsampwidth(), f.getframerate(), f.readframes(f.getnframes())
    if width != 2: raise ValueError("only PCM16 WAV is supported")
    audio=torch.frombuffer(bytearray(raw),dtype=torch.int16).float().view(-1,channels).mean(1)/32768
    if audio.numel()<n_fft: audio=torch.nn.functional.pad(audio,(0,n_fft-audio.numel()))
    spec=torch.stft(audio,n_fft=n_fft,hop_length=hop,win_length=n_fft,window=torch.hann_window(n_fft),return_complex=True).abs().pow(2)
    low,high=20.0,rate/2; lm,hm=1127*math.log1p(low/700),1127*math.log1p(high/700); hz=700*(torch.exp(torch.linspace(lm,hm,n_mels+2)/1127)-1); bins=torch.floor((n_fft+1)*hz/rate).long().clamp(0,n_fft//2); bank=torch.zeros(n_mels,n_fft//2+1)
    for m in range(1,n_mels+1):
        l,c,r=int(bins[m-1]),int(bins[m]),int(bins[m+1])
        if c>l: bank[m-1,l:c]=torch.arange(l,c)/(c-l)
        if r>c: bank[m-1,c:r]=(r-torch.arange(c,r))/(r-c)
    return torch.log(bank@spec+1e-5),rate

def griffin_lim(mel:torch.Tensor,rate:int=22050,n_fft:int=512,hop:int=128,steps:int=24):
    magnitude=torch.exp(mel).mean(0).clamp_min(1e-5); spec=magnitude.to(torch.complex64); length=max(n_fft,(magnitude.shape[-1]-1)*hop)
    for _ in range(steps):
        audio=torch.istft(spec,n_fft=n_fft,hop_length=hop,win_length=n_fft,window=torch.hann_window(n_fft),length=length)
        rebuilt=torch.stft(audio,n_fft=n_fft,hop_length=hop,win_length=n_fft,window=torch.hann_window(n_fft),return_complex=True); spec=magnitude.to(rebuilt.dtype)*torch.exp(1j*torch.angle(rebuilt))
    return audio.clamp(-1,1)

def wav_bytes(audio:torch.Tensor,rate:int=22050):
    raw=(audio*32767).short().numpy().tobytes(); out=io.BytesIO()
    with wave.open(out,"wb") as f: f.setnchannels(1); f.setsampwidth(2); f.setframerate(rate); f.writeframes(raw)
    return out.getvalue()
