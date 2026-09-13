import os from "node:os";
import { bobNativeModel } from "./nativeModel.js";
import { ensureSpecialist, specialistConfigured, stopSpecialist } from "./specialistRuntime.js";

export type RuntimeCapability = "chat" | "coding" | "vision" | "embedding" | "reranking" | "asr" | "tts" | "image";
export type RuntimeState = "cold" | "loading" | "ready" | "busy" | "error";
export type RuntimeModel = { id: string; capability: RuntimeCapability; memoryMb: number; priority: number; runnable: boolean; description: string };
export type RuntimeSnapshot = RuntimeModel & { state: RuntimeState; activeRequests: number; loadedAt?: string; lastUsedAt?: string; error?: string };
export type TaskPlan = { capabilities: RuntimeCapability[]; primary: RuntimeCapability; modelId?: string; reason: string; requiresSpecialist: boolean };
const MODEL_BUDGET_MB = Math.min(4096, Math.max(1024, Number(process.env.BOBAI_MODEL_MEMORY_BUDGET_MB || 3072)));
const IDLE_UNLOAD_MS = 300000;
export const RUNTIME_MODELS: RuntimeModel[] = [
 { id:"bob", capability:"chat", memoryMb:512, priority:100, runnable:true, description:"central text model" },
 { id:"coder", capability:"coding", memoryMb:512, priority:90, runnable:true, description:"coding profile" },
 { id:"bob-embed-0.1", capability:"embedding", memoryMb:384, priority:60, runnable:true, description:"Vector" },
 { id:"bob-reranker-0.1", capability:"reranking", memoryMb:256, priority:55, runnable:true, description:"Vanta reranker" },
 { id:"bob-vision-0.1", capability:"vision", memoryMb:768, priority:70, runnable:true, description:"Vanta" },
 { id:"bob-asr-0.1", capability:"asr", memoryMb:768, priority:70, runnable:true, description:"Echo recognition" },
 { id:"bob-tts-0.1", capability:"tts", memoryMb:768, priority:65, runnable:true, description:"Echo synthesis" },
 { id:"bob-image-0.1", capability:"image", memoryMb:1024, priority:50, runnable:true, description:"Flux" },
];
function messageText(messages: unknown) { if (!Array.isArray(messages)) return ""; return messages.map((item)=>item&&typeof item==="object"&&typeof (item as {content?:unknown}).content==="string"?(item as {content:string}).content:"").join(" ").toLowerCase().slice(-12000); }
export function inferTaskPlan(input:{messages?:unknown;hasImage?:boolean;hasAudio?:boolean;wantsImage?:boolean;wantsSpeech?:boolean}):TaskPlan {
 const text=messageText(input.messages), capabilities:RuntimeCapability[]=[]; const add=(x:RuntimeCapability)=>{if(!capabilities.includes(x))capabilities.push(x)};
 if(input.hasImage||/\b(image|photo|picture|screenshot|vision|see|look at)\b/.test(text))add("vision"); if(input.hasAudio||/\b(audio|voice|speech|listen|transcribe|transcription|hear)\b/.test(text))add("asr"); if(input.wantsSpeech||/\b(speak|read aloud|voice response|pronounce)\b/.test(text))add("tts"); if(input.wantsImage||/\b(generate|create|draw|make)\b.{0,40}\b(image|picture|art|illustration)\b/.test(text))add("image"); if(/\b(remember|memory|similar|semantic|embed|embedding)\b/.test(text))add("embedding"); if(/\b(search|retrieve|rank|relevant|best match)\b/.test(text))add("reranking"); if(/\b(code|coding|program|debug|typescript|javascript|python|sql)\b/.test(text))add("coding"); if(!capabilities.length)add("chat");
 const primary=capabilities[0]; const model=RUNTIME_MODELS.find(x=>x.capability===primary); return {capabilities,primary,modelId:model?.id,reason:model?`selected ${model.id}`:`no runtime for ${primary}`,requiresSpecialist:primary!=="chat"&&primary!=="coding"};
}
type Entry={model:RuntimeModel;state:RuntimeState;activeRequests:number;loadedAt?:string;lastUsedAt?:string;error?:string;stop?:()=>Promise<void>};
export class ModelRuntimeManager {
 private entries=new Map<string,Entry>(RUNTIME_MODELS.map(model=>[model.id,{model,state:"cold",activeRequests:0}]));
 private nativeRefs=0;
 private loadedMemory(){return [...this.entries.values()].filter(e=>e.state==="ready"||e.state==="busy").reduce((s,e)=>s+e.model.memoryMb,0)}
 constructor(){const timer=setInterval(()=>void this.evictIdle(),60000);timer.unref();}
 private async loadNative(id:string){if(this.nativeRefs===0)await bobNativeModel.load();this.nativeRefs++;this.entries.get(id)!.stop=async()=>{this.nativeRefs=Math.max(0,this.nativeRefs-1);if(this.nativeRefs===0)await bobNativeModel.unload();};}
 async load(id:string){const entry=this.entries.get(id);if(!entry)throw new Error(`unknown runtime model: ${id}`);if(entry.state==="ready"||entry.state==="busy")return;if(this.loadedMemory()+entry.model.memoryMb>MODEL_BUDGET_MB){const victims=[...this.entries.values()].filter(e=>e.model.id!==id&&e.activeRequests===0&&e.state==="ready").sort((a,b)=>a.model.priority-b.model.priority||Date.parse(a.lastUsedAt||"1970-01-01")-Date.parse(b.lastUsedAt||"1970-01-01"));for(const victim of victims){await this.unload(victim.model.id);if(this.loadedMemory()+entry.model.memoryMb<=MODEL_BUDGET_MB)break;}}
 if(this.loadedMemory()+entry.model.memoryMb>MODEL_BUDGET_MB)throw new Error("model memory budget is exhausted");entry.state="loading";entry.error=undefined;try{if(id==="bob"||id==="coder")await this.loadNative(id);else{if(!specialistConfigured(entry.model.capability))throw new Error(`no ${entry.model.id} artifact configured`);await ensureSpecialist(entry.model.capability);entry.stop=async()=>{await stopSpecialist(entry.model.capability);};}entry.state="ready";entry.loadedAt=new Date().toISOString();entry.lastUsedAt=entry.loadedAt;}catch(error){entry.state="error";entry.error=error instanceof Error?error.message:"model load failed";throw error;}}
 async acquire(id:string){await this.load(id);const entry=this.entries.get(id)!;entry.activeRequests++;entry.state="busy";entry.lastUsedAt=new Date().toISOString();let released=false;return()=>{if(released)return;released=true;entry.activeRequests=Math.max(0,entry.activeRequests-1);entry.state=entry.activeRequests?"busy":"ready";entry.lastUsedAt=new Date().toISOString();};}
 async unload(id:string){const entry=this.entries.get(id);if(!entry||entry.activeRequests)return false;if(entry.stop)await entry.stop().catch(()=>undefined);entry.stop=undefined;entry.state="cold";entry.loadedAt=undefined;return true;}
 async evictIdle(){const cutoff=Date.now()-IDLE_UNLOAD_MS;for(const entry of this.entries.values())if(!entry.activeRequests&&entry.state==="ready"&&entry.lastUsedAt&&Date.parse(entry.lastUsedAt)<cutoff)await this.unload(entry.model.id);}
 snapshot():RuntimeSnapshot[]{return [...this.entries.values()].map(({model,state,activeRequests,loadedAt,lastUsedAt,error})=>({...model,state,activeRequests,loadedAt,lastUsedAt,error}));}
 resources(){return{totalMemoryMb:Math.round(os.totalmem()/1048576),freeMemoryMb:Math.round(os.freemem()/1048576),cpuCount:os.cpus().length,modelBudgetMb:MODEL_BUDGET_MB,loadedModelMemoryMb:this.loadedMemory()};}
 async plan(input:Parameters<typeof inferTaskPlan>[0]){const plan=inferTaskPlan(input);const model=RUNTIME_MODELS.find(x=>x.id===plan.modelId);if(!model)return{...plan,available:false};try{await this.load(model.id);return{...plan,available:true,runtime:this.snapshot().find(x=>x.id===model.id)}}catch(error){return{...plan,available:false,error:error instanceof Error?error.message:"runtime unavailable"};}}
}
export const modelRuntime=new ModelRuntimeManager();
