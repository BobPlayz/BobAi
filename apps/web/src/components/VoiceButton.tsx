"use client";
import { useEffect,useRef,useState } from "react";
import { Mic,Square,Volume2 } from "lucide-react";
import { synthesizeSpeech,transcribeAudio } from "@/lib/voice";
import { setAssistantActivity } from "@/lib/assistantState";

// Replies already spoken automatically, so re-renders or revisiting a chat never replay them.
const autoSpoken = new Set<string>();

type Props={onTranscript:(text:string)=>void;disabled?:boolean;readAloudText?:string;/** Speak this reply once, automatically (voice replies toggle). */autoPlayId?:string};

async function toPcm16Wav(recording: Blob): Promise<Blob> {
 const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
 if (!AudioContextClass) throw new Error("This browser cannot convert microphone audio for transcription.");
 const context = new AudioContextClass();
 try {
  const decoded = await context.decodeAudioData(await recording.arrayBuffer());
  const targetRate = 16_000;
  const outputLength = Math.ceil(decoded.length * targetRate / decoded.sampleRate);
  if (!outputLength || outputLength > targetRate * 180) throw new Error("Voice input must be 3 minutes or shorter.");
  const buffer = new ArrayBuffer(44 + outputLength * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  writeText(0, "RIFF"); view.setUint32(4, 36 + outputLength * 2, true); writeText(8, "WAVE"); writeText(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, targetRate, true); view.setUint32(28, targetRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); writeText(36, "data"); view.setUint32(40, outputLength * 2, true);
  const channels = Array.from({ length: decoded.numberOfChannels }, (_, channel) => decoded.getChannelData(channel));
  for (let i = 0; i < outputLength; i++) {
   const sourceStart = i * decoded.sampleRate / targetRate;
   const sourceIndex = Math.min(decoded.length - 1, Math.floor(sourceStart));
   const fraction = sourceStart - sourceIndex;
   let sample = 0;
   for (const channel of channels) sample += channel[sourceIndex] * (1 - fraction) + (channel[Math.min(sourceIndex + 1, decoded.length - 1)] ?? 0) * fraction;
   sample /= channels.length;
   const clipped = Math.max(-1, Math.min(1, sample));
   view.setInt16(44 + i * 2, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
 } finally { await context.close().catch(() => undefined); }
}
export default function VoiceButton({onTranscript,disabled=false,readAloudText,autoPlayId}:Props){const recorder=useRef<MediaRecorder|null>(null);const micStream=useRef<MediaStream|null>(null);const audioRef=useRef<HTMLAudioElement|null>(null);const mounted=useRef(true);const [speaking,setSpeaking]=useState(false);const chunks=useRef<Blob[]>([]);const [recording,setRecording]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;const active=recorder.current;if(active){active.onstop=null;if(active.state!=="inactive")active.stop()}micStream.current?.getTracks().forEach(track=>track.stop());micStream.current=null;audioRef.current?.pause();if(audioRef.current?.src.startsWith("blob:"))URL.revokeObjectURL(audioRef.current.src);audioRef.current=null}},[]);
 async function start(){setError("");try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});if(!mounted.current){stream.getTracks().forEach(track=>track.stop());return}micStream.current=stream;const mime=["audio/webm;codecs=opus","audio/webm","audio/mp4","audio/ogg"].find((type)=>MediaRecorder.isTypeSupported(type));const r=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);const recordingMime=r.mimeType||mime||"application/octet-stream";chunks.current=[];r.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data)};r.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());if(micStream.current===stream)micStream.current=null;if(!mounted.current)return;setRecording(false);setBusy(true);try{const wav=await toPcm16Wav(new Blob(chunks.current,{type:recordingMime}));const text=await transcribeAudio(wav);if(mounted.current)onTranscript(text)}catch(e){if(mounted.current)setError(e instanceof Error?e.message:"transcription failed")}finally{if(mounted.current)setBusy(false)}};recorder.current=r;r.start();setRecording(true)}catch(e){micStream.current?.getTracks().forEach(track=>track.stop());micStream.current=null;if(mounted.current)setError(e instanceof Error?e.message:"microphone unavailable")}}
 useEffect(()=>{if(!recording)return;setAssistantActivity("voice-input",true);return()=>setAssistantActivity("voice-input",false)},[recording]);
 useEffect(()=>{if(!speaking)return;setAssistantActivity("voice-output",true);return()=>setAssistantActivity("voice-output",false)},[speaking]);
 useEffect(()=>{if(!autoPlayId||autoSpoken.has(autoPlayId)||!readAloudText?.trim())return;autoSpoken.add(autoPlayId);void speak()
 },[autoPlayId]);
 function stop(){recorder.current?.stop()}
 function stopSpeaking(){const audio=audioRef.current;if(audio){audio.pause();audio.currentTime=0;if(audio.src.startsWith("blob:"))URL.revokeObjectURL(audio.src);audioRef.current=null}setSpeaking(false)}
 async function speak(){if(audioRef.current&&speaking){stopSpeaking();return}if(!readAloudText?.trim())return;setError("");setBusy(true);try{const result=await synthesizeSpeech(readAloudText);if(!mounted.current)return;const raw=atob(result.audio);const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);const url=URL.createObjectURL(new Blob([bytes],{type:result.mimeType}));const audio=new Audio(url);audioRef.current=audio;audio.onended=()=>{URL.revokeObjectURL(url);if(audioRef.current===audio)audioRef.current=null;setSpeaking(false)};audio.onerror=()=>{URL.revokeObjectURL(url);if(audioRef.current===audio)audioRef.current=null;setSpeaking(false)};await audio.play();setSpeaking(true)}catch(e){if(mounted.current){setError(e instanceof Error?e.message:"speech playback failed");stopSpeaking()}}finally{if(mounted.current)setBusy(false)}}
 return <div className="flex items-center gap-2">{readAloudText!==undefined&&<button type="button" onClick={speak} disabled={disabled||busy||!readAloudText.trim()} aria-label={speaking ? "Stop reading aloud" : "Read this reply aloud"} title={speaking ? "Stop" : "Read aloud (Alan)"} data-active={speaking} className="atelier-iconbtn">{speaking ? <Square className="h-3.5 w-3.5" aria-hidden/> : <Volume2 className="h-4 w-4" aria-hidden/>}</button>}{readAloudText===undefined&&<button type="button" onClick={recording?stop:start} disabled={disabled||busy} aria-label={recording?"Stop recording":"Speak to Jarvis"} title={recording?"Stop recording":"Voice input"} data-active={recording} className="atelier-iconbtn">{recording?<Square className="h-3.5 w-3.5" aria-hidden/>:<Mic className="h-4 w-4" aria-hidden/>}</button>}{busy&&<span className="caption normal-case tracking-normal" role="status">{readAloudText===undefined?"Transcribing…":"Preparing voice…"}</span>}{error&&<span role="alert" className="max-w-56 truncate text-xs text-[var(--accent)]" title={error}>{error}</span>}</div>}
