import { modelRuntime } from "./modelRuntime.js";
import { specialistConfigured, specialistInfer } from "./specialistRuntime.js";

export function echoConfigured(kind: "asr" | "tts") { return specialistConfigured(kind); }
export async function echoTranscribe(audio: Buffer) { const release=await modelRuntime.acquire("bob-asr-0.1"); try{return await specialistInfer("asr",{audioBase64:audio.toString("base64")});}finally{release();} }
export async function echoSynthesize(text:string,frames?:number) { const release=await modelRuntime.acquire("bob-tts-0.1"); try{return await specialistInfer("tts",{text,frames:frames??Math.max(16,Math.min(512,text.length*4))});}finally{release();} }
