import { specialistConfigured, specialistInfer } from "./specialistRuntime.js";
import { modelRuntime } from "./modelRuntime.js";
const MAX_IMAGE_BYTES=12*1024*1024; const MAX_PROMPT_LENGTH=8000;
export async function analyzeImage(imageBase64:string,prompt="analyze this image"){
 const normalized=imageBase64.replace(/^data:[^;]+;base64,/,'').trim(); if(!normalized)throw new Error("image data is required"); if(normalized.length>Math.ceil(MAX_IMAGE_BYTES*4/3))throw new Error("image exceeds the 12 MB limit"); if(typeof prompt!=="string"||prompt.length>MAX_PROMPT_LENGTH)throw new Error("vision prompt is too long"); if(!specialistConfigured("vision"))throw new Error("Vanta is not trained/configured yet");
 const release=await modelRuntime.acquire("bob-vision-0.1"); try{const result=await specialistInfer("vision",{imageBase64:normalized}); const vector=Array.isArray(result.vector)?result.vector.filter((x):x is number=>typeof x==="number"):[]; if(!vector.length)throw new Error("Vanta returned no visual embedding"); return{model:"Vanta",response:`Vanta analyzed the image for: ${prompt.trim()||"the user's request"}. Visual embedding ready (${vector.length} dimensions).`,embedding:vector};}finally{release();}
}
