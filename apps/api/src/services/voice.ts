import { piperStatus, synthesizeLocal } from "./bobVoice.js";
import { transcribeLocal, whisperStatus } from "./whisperCpp.js";
import { echoConfigured, echoSynthesize, echoTranscribe } from "./echo.js";
import { boundedExecutionResult } from "./executionGuard.js";
import { boundedText, providerUrl } from "./httpSafety.js";

export type VoiceProvider={transcribe?:(input:Buffer,options?:Record<string,unknown>)=>Promise<unknown>;synthesize?:(text:string,options?:Record<string,unknown>)=>Promise<unknown>};
let provider:VoiceProvider|null=null;
export const setVoiceProvider=(next:VoiceProvider|null)=>{provider=next};

function configuredHttpProvider():VoiceProvider|null {
 const raw=process.env.BOBAI_VOICE_PROVIDER_URL?.trim(); if(!raw) return null; const url=providerUrl(raw); const key=process.env.BOBAI_VOICE_PROVIDER_KEY?.trim(); const headers=()=>({"content-type":"application/json",...(key?{authorization:`Bearer ${key}`}:{})});
 const request=async(path:string,payload:Record<string,unknown>)=>{const controller=new AbortController();const timeout=Number(process.env.BOBAI_PROVIDER_TIMEOUT_MS||120000);const timer=setTimeout(()=>controller.abort(),Math.min(Math.max(Number.isFinite(timeout)?timeout:120000,5000),300000));try{const response=await fetch(`${url}/${path}`,{method:"POST",headers:headers(),body:JSON.stringify(payload),signal:controller.signal,redirect:"error"});const text=await boundedText(response,10*1024*1024);if(!response.ok)throw new Error(`voice provider returned ${response.status}`);if(!text.trim())return {};let parsed:unknown;try{parsed=JSON.parse(text)}catch{parsed={data:text}}return boundedExecutionResult(parsed)}finally{clearTimeout(timer)}};
 return {transcribe:(input,options)=>request("transcribe",{audio:input.toString("base64"),options:options&&typeof options==="object"&&!Array.isArray(options)?options:{}}),synthesize:(text,options)=>request("synthesize",{text,options:options&&typeof options==="object"&&!Array.isArray(options)?options:{}})};
}

export const transcribe=async(input:Buffer,options?:Record<string,unknown>)=>{if(provider?.transcribe)return provider.transcribe(input,options);const http=configuredHttpProvider();if(http?.transcribe)return http.transcribe(input,options);if(echoConfigured("asr"))return echoTranscribe(input);return transcribeLocal(input,options)};
export const synthesize=async(text:string,options?:Record<string,unknown>)=>{if(provider?.synthesize)return provider.synthesize(text,options);const http=configuredHttpProvider();if(http?.synthesize)return http.synthesize(text,options);if(echoConfigured("tts"))return echoSynthesize(text,typeof options?.frames==="number"?Math.trunc(options.frames):undefined);return synthesizeLocal(text,options)};
export const status=async()=>({local:{echo:{asr:echoConfigured("asr"),tts:echoConfigured("tts")},whisper:await whisperStatus(),piper:await piperStatus()},externalProviderConfigured:Boolean(provider||process.env.BOBAI_VOICE_PROVIDER_URL?.trim())});
