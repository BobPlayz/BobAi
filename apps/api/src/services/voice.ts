import { piperStatus, synthesizeLocal } from "./bobVoice.js";
import { transcribeLocal, whisperStatus } from "./whisperCpp.js";
import { echoConfigured, echoSynthesize, echoTranscribe } from "./echo.js";
export type VoiceProvider={transcribe?:(input:Buffer,options?:Record<string,unknown>)=>Promise<unknown>;synthesize?:(text:string,options?:Record<string,unknown>)=>Promise<unknown>};
let provider:VoiceProvider|null=null; export const setVoiceProvider=(next:VoiceProvider|null)=>{provider=next};
export const transcribe=async(input:Buffer,options?:Record<string,unknown>)=>{if(provider?.transcribe)return provider.transcribe(input,options);if(echoConfigured("asr"))return echoTranscribe(input);return transcribeLocal(input,options);};
export const synthesize=async(text:string,options?:Record<string,unknown>)=>{if(provider?.synthesize)return provider.synthesize(text,options);if(echoConfigured("tts"))return echoSynthesize(text,typeof options?.frames==="number"?Math.trunc(options.frames):undefined);return synthesizeLocal(text,options);};
export const status=async()=>({local:{echo:{asr:echoConfigured("asr"),tts:echoConfigured("tts")},whisper:await whisperStatus(),piper:await piperStatus()},externalProviderConfigured:Boolean(provider)});
